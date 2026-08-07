import { Worker } from "bullmq";
import { INGEST_QUEUE_NAME, getRedisConnection, type IngestEmailJobData } from "./queue";
import { processInboundMessage } from "./pipeline";

/**
 * Crea (y devuelve) el Worker de ingesta. El processor es un wrapper fino:
 * toda la lógica está en processInboundMessage, que también usa el smoke
 * end-to-end y los tests — acá solo vivimos el transporte.
 */
export function startIngestWorker(): Worker<IngestEmailJobData> {
  const worker = new Worker<IngestEmailJobData>(
    INGEST_QUEUE_NAME,
    async (job) => {
      const { inboundMessageId, userId } = job.data;
      await processInboundMessage(userId, inboundMessageId);
    },
    { connection: getRedisConnection() },
  );

  worker.on("failed", (job, err) => {
    console.error(`[ingest] job ${job?.id} falló:`, err);
  });

  return worker;
}
