import { startIngestWorker } from "./worker";

const worker = startIngestWorker();

console.log("[ingest] worker corriendo. Ctrl+C para frenar.");

process.on("SIGINT", async () => {
  await worker.close();
  process.exit(0);
});
