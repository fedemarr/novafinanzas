import type { ParsedItem, Parser, RawEmail } from "@/lib/domain/ingest";
import { normalizeMerchant } from "@/lib/domain/ingest";

// ============================================================================
// Parser Mercado Pago (M4 — primer parser end-to-end).
//
// Estrategia conservadora: solo devuelve resultado cuando encuentra de forma
// inequívoca monto + moneda + fecha. Si algo falta o no matchea, devuelve
// null y el pipeline marca FAILED — NUNCA se inventa un monto.
//
// [PENDIENTE] primer pase a partir del formato típico de MP; se afina con un
// mail real reenviado por el usuario (sample real para el smoke M4).
// ============================================================================

const MP_DOMAINS = ["mercadopago.com.ar", "mercadopago.com"];

const AMOUNT_LINE_RE =
  /(?:monto total|monto|total)\s*:\s*(?:ars\s*)?\$?\s*(\d+(?:[.,]\d+)*)/i;
const PAID_LINE_RE = /pagaste\s+(?:ars\s*)?\$?\s*(\d+(?:[.,]\d+)*)/i;
const RECEIVED_AMOUNT_RE = /recibiste un pago (?:de|por)\s+(?:ars\s*)?\$?\s*(\d+(?:[.,]\d+)*)/i;
const DATE_RE = /(?:fecha de pago|fecha de compra|fecha)\s*:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i;
const MERCHANT_LINE_RE = /(?:comercio|vendedor|a)\s*:\s*([^\n]+)/i;
const RECEIVED_RE = /recibiste un pago|te acreditamos|recibimos tu pago/i;

export const parseMercadoPago: Parser = (email: RawEmail) => {
  const from = email.fromAddress.toLowerCase();
  if (!MP_DOMAINS.some((domain) => from.includes(domain))) return null;

  const text = email.textBody;

  const amountMatch = text.match(AMOUNT_LINE_RE) ?? text.match(PAID_LINE_RE) ?? text.match(RECEIVED_AMOUNT_RE);
  if (!amountMatch) return null;

  const amount = parseAmountString(amountMatch[1]);
  if (!amount) return null;

  const dateMatch = text.match(DATE_RE);
  if (!dateMatch) return null;
  const occurredAt = new Date(
    Date.UTC(Number(dateMatch[3]), Number(dateMatch[2]) - 1, Number(dateMatch[1])),
  );

  const merchantRaw = text.match(MERCHANT_LINE_RE)?.[1]?.trim() ?? null;

  const currencyCode = /\bUS\$\b|USD\b/i.test(text) ? "USD" : "ARS";
  const type = RECEIVED_RE.test(text) ? "INCOME" : "EXPENSE";

  const item: ParsedItem = {
    type,
    amount,
    currencyCode,
    occurredAt,
    merchantRaw,
    merchantNormalized: normalizeMerchant(merchantRaw),
    description: merchantRaw ?? email.subject.trim(),
  };

  return { parserKey: "mercadopago", institutionName: "Mercado Pago", items: [item] };
};

/**
 * "12.500,00" → "12500.00" · "12500.00" → "12500.00" · "12,500.00" → "12500.00".
 * Devuelve null si el string no parece un número.
 */
export function parseAmountString(raw: string): string | null {
  const s = raw.replace(/\s+/g, "");
  if (!/^[\d.,]+$/.test(s)) return null;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      return s.replace(/\./g, "").replace(",", "."); // 12.500,00
    }
    return s.replace(/,/g, ""); // 12,500.00
  }
  if (hasComma) return s.replace(",", ".");
  return s;
}
