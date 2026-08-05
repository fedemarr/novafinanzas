import { randomBytes } from "crypto";

// [DECISIÓN ABIERTA] el dominio real de ingesta (PROJECT.md sección 8, M4)
// todavía no está definido por el usuario — ver lista de decisiones
// pendientes. Uso un placeholder configurable por env var para no bloquear
// M0; cambiar INGEST_DOMAIN no requiere tocar código en ningún otro lado.
const INGEST_DOMAIN = process.env.INGEST_DOMAIN ?? "ingest.nova.local";

/** Genera un alias único tipo `u-a8f3c2d1@dominio` para recibir mails reenviados. */
export function generateIngestAddress(): string {
  const slug = randomBytes(4).toString("hex");
  return `u-${slug}@${INGEST_DOMAIN}`;
}
