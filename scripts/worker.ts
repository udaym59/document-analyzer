/**
 * Standalone worker — run with `npm run worker` for production or whenever
 * you want to scale indexing independently of the web server. Set
 * DISABLE_INLINE_WORKER=1 on the web process to avoid double-processing.
 */
import "dotenv/config";
import { startIndexingWorker, getBoss } from "../src/features/documents/server/queue";

async function main() {
  await startIndexingWorker({ concurrency: 4 });
  console.log("[worker] running. Ctrl-C to exit.");
  const shutdown = async () => {
    console.log("[worker] shutting down…");
    const boss = await getBoss();
    await boss.stop({ graceful: true, timeout: 30_000 });
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => { console.error(e); process.exit(1); });
