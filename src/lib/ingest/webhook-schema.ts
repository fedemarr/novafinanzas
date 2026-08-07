import { z } from "zod";

// ============================================================================
// Payload de Postmark Inbound. Solo los campos que usa el pipeline; el resto
// se ignora. Postmark reenvía el mail original, así que From/To pueden venir
// con nombre ("Nombre <mail@x.com>") — por eso extractEmailAddress.
// ============================================================================

export const postmarkInboundSchema = z.object({
  From: z.string().min(1),
  To: z.string().optional(),
  ToFull: z
    .array(z.object({ Email: z.string().min(1), Name: z.string().optional() }))
    .optional()
    .default([]),
  Subject: z.string().optional(),
  MessageID: z.string().min(1),
  Date: z.string().optional(),
  TextBody: z.string().optional(),
  HtmlBody: z.string().optional(),
});

export type PostmarkInbound = z.infer<typeof postmarkInboundSchema>;

/** "Nombre <mail@x.com>" → "mail@x.com"; si ya es un mail pelado, lo devuelve. */
export function extractEmailAddress(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/<([^>]+)>/);
  return (match ? match[1] : trimmed).trim().toLowerCase();
}
