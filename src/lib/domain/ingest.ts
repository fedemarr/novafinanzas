import type Decimal from "decimal.js";
import { money, parseAmountInput, type Money } from "./money";
import { computeDedupeHash } from "./dedupe-hash";

// ============================================================================
// Contrato de ingesta por email (M4). Vive en domain porque define cómo se
// convierte un mail en datos de dinero seguros: monto con su moneda, sin
// float, sin inventar datos. Los parsers (src/lib/ingest/parsers/) importan
// estos tipos; el pipeline orquesta con la DB.
// ============================================================================

export interface RawEmail {
  fromAddress: string;
  subject: string;
  textBody: string;
}

export type ParsedItemType = "EXPENSE" | "INCOME";

export interface ParsedItem {
  type: ParsedItemType;
  /** Nunca float: Decimal.Value (string o decimal.js). */
  amount: Decimal.Value;
  currencyCode: string;
  occurredAt: Date;
  merchantRaw: string | null;
  merchantNormalized: string | null;
  description: string | null;
}

export interface ParseResult {
  parserKey: string;
  institutionName: string;
  items: ParsedItem[];
}

export type Parser = (email: RawEmail) => ParseResult | null;

/**
 * Normaliza un comercio para comparación/dedupe: minúsculas, sin espacios
 * de más. No pretende resolver todas las variantes — el matching ±1 día y
 * por variantes es de M5.
 */
export function normalizeMerchant(raw: string | null): string | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return normalized === "" ? null : normalized;
}

/**
 * Convierte un ítem parseado en un Money seguro: el monto pasa por
 * parseAmountInput (rechaza cero/negativos y no-number). Un ítem sin monto
 * válido es un parseo incompleto — nunca se inventa ni se redondea a mano.
 */
export function itemToMoney(item: ParsedItem): Money {
  if (!item.currencyCode.trim()) {
    throw new Error("El mail no tiene moneda válida.");
  }
  const amount = parseAmountInput(String(item.amount));
  return money(amount, item.currencyCode.trim());
}

/**
 * Dedupe exacto del ítem (caso exacto, no ventana ±1 día — eso es M5).
 * merchantKey prioriza merchantNormalized sobre raw sobre description.
 */
export function itemDedupeHash(
  item: ParsedItem,
  ctx: { userId: string; accountId: string },
): string {
  return computeDedupeHash({
    userId: ctx.userId,
    accountId: ctx.accountId,
    amount: itemToMoney(item).amount.toString(),
    currency: itemToMoney(item).currency,
    occurredAt: item.occurredAt,
    merchantKey: item.merchantNormalized ?? item.merchantRaw ?? item.description,
  });
}
