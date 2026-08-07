import IORedis from "ioredis";
import { Queue, type JobsOptions } from "bullmq";

// ============================================================================
// Cola de ingesta (PROJECT.md M4): el webhook de Postmark SOLO encola; el
// parseo lo hace un Worker (ver src/lib/ingest/worker.ts). Requiere Redis —
// Upstash en producción/dev, definido por REDIS_URL.
// ============================================================================

export const INGEST_QUEUE_NAME = "ingest-email";

export interface IngestEmailJobData {
  inboundMessageId: string;
  userId: string;
}

let redis: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!redis) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error("REDIS_URL no está configurada (BullMQ/ingesta por email).");
    }
    // maxRetriesPerRequest: null es obligatorio para BullMQ Workers.
    redis = new IORedis(url, { maxRetriesPerRequest: null });
  }
  return redis;
}

let queue: Queue<IngestEmailJobData> | null = null;

export function getIngestQueue(): Queue<IngestEmailJobData> {
  if (!queue) {
    queue = new Queue<IngestEmailJobData>(INGEST_QUEUE_NAME, {
      connection: getRedisConnection(),
    });
  }
  return queue;
}

/**
 * Encola el procesamiento de un mail recibido. jobId = inboundMessageId:
 * si el webhook se reintenta (Postmark re-delivers) no encolamos dos jobs.
 */
export async function enqueueInboundEmail(
  data: IngestEmailJobData,
  options?: JobsOptions,
): Promise<void> {
  await getIngestQueue().add(INGEST_QUEUE_NAME, data, {
    jobId: data.inboundMessageId,
    removeOnComplete: 100,
    removeOnFail: 1000,
    ...options,
  });
}
