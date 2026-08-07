import { createHash } from "crypto";
import type Decimal from "decimal.js";

/**
 * [DECISIÓN — ver revisión del schema] un hash necesita input exacto y
 * determinístico; "fecha ±1 día" del doc es una ventana difusa, no sirve
 * como input de hash. Acá la fecha se trunca al día exacto — el matching
 * por ventana de ±1 día (mail vs. resumen que llegan con fechas distintas)
 * es una query aparte en el momento de la ingesta (M4/M5), no este hash.
 * Este hash solo atrapa el caso exacto: incluso así sirve para M1 (evita
 * cargar el mismo gasto manual dos veces por error de doble click/submit).
 */
export interface DedupeInput {
  userId: string;
  accountId: string;
  amount: Decimal.Value;
  currency: string;
  occurredAt: Date;
  /** merchantNormalized si existe; si no, se usa lo que haya (description). */
  merchantKey: string | null;
}

export function computeDedupeHash(input: DedupeInput): string {
  const day = input.occurredAt.toISOString().slice(0, 10); // YYYY-MM-DD
  const merchant = (input.merchantKey ?? "").trim().toLowerCase();
  const raw = [
    input.userId,
    input.accountId,
    input.amount.toString(),
    input.currency,
    day,
    merchant,
  ].join("|");
  return createHash("sha256").update(raw).digest("hex");
}
