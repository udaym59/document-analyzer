import "server-only";
// import PgBoss from "pg-boss";
import { env } from "@/shared/lib/env";
import { indexDocument } from "./indexer";
import { PgBoss } from "pg-boss";

export const QUEUE_INDEX = "index-document";
export type IndexJob = { documentId: string };

// Lazy singleton. Reused across HMR reloads in dev so we don't spawn N instances.
const g = globalThis as unknown as { boss?: PgBoss; bossReady?: Promise<PgBoss> };

async function build(): Promise<PgBoss> {
  const boss = new PgBoss(env.DATABASE_URL);
  boss.on("error", (err) => console.error("[pg-boss]", err));
  await boss.start();
  // v11+: queues must be explicitly created before sending or working them.
  await boss.createQueue(QUEUE_INDEX);
  return boss;
}

export async function getBoss(): Promise<PgBoss> {
  if (g.boss) return g.boss;
  if (!g.bossReady) g.bossReady = build().then((b) => (g.boss = b));
  return g.bossReady;
}

/** Enqueue a document for background indexing. Retries + dedupe set per-job. */
export async function enqueueIndexing(documentId: string): Promise<string | null> {
  const boss = await getBoss();
  return boss.send(QUEUE_INDEX, { documentId } satisfies IndexJob, {
    singletonKey: documentId,
    retryLimit: 3,
    retryBackoff: true,
    retryDelay: 10,            // seconds, exponential thereafter
  });
}

/** Register the worker handler. Called from instrumentation.ts and worker.ts. */
export async function startIndexingWorker(opts: { concurrency?: number } = {}) {
  const boss = await getBoss();
  await boss.work<IndexJob>(
    QUEUE_INDEX,
    { localConcurrency: opts.concurrency ?? 2, batchSize: 1 },
    async ([job]) => {
      // batchSize=1 → each call gets a single-element array.
      if (!job) return;
      try { await indexDocument(job.data.documentId); }
      catch (e) { console.error("[index-document]", job.id, e); throw e; }
    },
  );
  console.log("[pg-boss] worker started");
}
