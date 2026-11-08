// Runs once per server process boot. Also runs in dev with HMR; the worker
// singleton inside queue.ts prevents duplicates.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DISABLE_INLINE_WORKER === "1") {
    console.log("[instrumentation] inline worker disabled (DISABLE_INLINE_WORKER=1)");
    return;
  }
  const { startIndexingWorker } = await import("@/features/documents/server/queue");
  await startIndexingWorker({ teamSize: 2 });
}
