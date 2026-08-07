import Decimal from "decimal.js";
import { RRule } from "rrule";
import { type Money, money } from "./money";

// ============================================================================
// Motor de compromisos (M2). Genera las ocurrencias que se materializan en
// CommitmentOccurrence. Puro — no toca la DB, no sabe qué es Prisma.
//
// Decisión de modelado (aprobada por el usuario):
//   - CARD_INSTALLMENT / LOAN / DEBT → `totalAmount` es el TOTAL a financiar,
//     repartido en `installmentTotal` cuotas mensuales iguales. La última
//     cuota absorbe el resto del redondeo (como en la vida real).
//   - SUBSCRIPTION / FIXED_EXPENSE → `totalAmount` ES el monto por período
//     (no hay un "total" finito). Cada ocurrencia vale `totalAmount`.
//
// El horizonte de generación para recurrentes sin fin es fijo (+12 meses
// desde hoy, el ancho del timeline de la pantalla Compromisos). Cuando M3
// (safe-to-spend) necesite más horizonte, se materializa más.
// ============================================================================

export const RECURRING_KINDS = ["SUBSCRIPTION", "FIXED_EXPENSE"] as const;
export const FINITE_KINDS = ["CARD_INSTALLMENT", "LOAN", "DEBT"] as const;

export type RecurringKind = (typeof RECURRING_KINDS)[number];
export type FiniteKind = (typeof FINITE_KINDS)[number];
export type CommitmentKind = RecurringKind | FiniteKind;

export interface CommitmentSpec {
  kind: CommitmentKind;
  /** Para kinds finitos: el total a financiar. Para recurrentes: el monto por período. */
  totalAmount: Decimal.Value;
  currency: string;
  /** Precisión de redondeo del monto, sale de Currency.decimals. */
  decimals: number;
  startDate: Date;
  endDate: Date | null;
  /** Obligatorio para kinds finitos: cantidad de cuotas. */
  installmentTotal: number | null;
  /** Obligatorio para recurrentes: RRULE (ej. "FREQ=MONTHLY;BYMONTHDAY=5"). */
  recurrenceRule: string | null;
}

/** Una ocurrencia lista para persistir — monto con su moneda (invariante #2). */
export interface OccurrenceDraft {
  dueDate: Date;
  amount: Money;
  installmentNumber: number | null;
  installmentTotal: number | null;
}

export function isFiniteKind(kind: CommitmentKind): kind is FiniteKind {
  return (FINITE_KINDS as readonly string[]).includes(kind);
}

export function isRecurringKind(kind: CommitmentKind): kind is RecurringKind {
  return (RECURRING_KINDS as readonly string[]).includes(kind);
}

/** Suma N meses a una fecha en UTC, saturando el día al último del mes
 *  (ej. 31 ene + 1 mes → 28 feb, no 3 mar). */
export function addMonthsUtc(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/** Fin del horizonte de generación de ocurrencias (por defecto el ancho del
 *  timeline: 12 meses desde hoy). */
export function commitmentHorizonEnd(from: Date = new Date(), months = 12): Date {
  return addMonthsUtc(from, months);
}

/**
 * Genera todos los drafts de ocurrencias de un compromiso.
 *
 * - Finito: exactamente `installmentTotal` cuotas, una por mes desde
 *   startDate. Ignora el horizonte: el total de cuotas es acotado y son
 *   todas deuda comprometida, aunque algunas hayan vencido.
 * - Recurrente: desde startDate hasta el menor entre endDate y el
 *   horizonte. Un compromiso viejo regenera también sus ocurrencias
 *   pasadas — son deuda real, y M3/M5 las van a matchear contra
 *   transacciones. El timeline solo muestra las futuras.
 */
export function buildOccurrenceDrafts(
  spec: CommitmentSpec,
  horizonEnd: Date,
): OccurrenceDraft[] {
  if (spec.totalAmount.toString() === "0" || new Decimal(spec.totalAmount).isNegative()) {
    throw new Error("El monto del compromiso tiene que ser mayor a cero.");
  }
  if (spec.endDate && spec.endDate < spec.startDate) {
    throw new Error("La fecha de fin no puede ser anterior a la de inicio.");
  }

  if (isFiniteKind(spec.kind)) {
    return buildInstallmentDrafts(spec);
  }
  return buildRecurringDrafts(spec, horizonEnd);
}

function buildInstallmentDrafts(spec: CommitmentSpec): OccurrenceDraft[] {
  if (!spec.installmentTotal || spec.installmentTotal < 1) {
    throw new Error("Un compromiso en cuotas necesita la cantidad de cuotas.");
  }
  const count = spec.installmentTotal;
  const parts = splitIntoInstallments(new Decimal(spec.totalAmount), count, spec.decimals);

  return parts.map((amount, i) => ({
    dueDate: addMonthsUtc(spec.startDate, i),
    amount: money(amount, spec.currency),
    installmentNumber: i + 1,
    installmentTotal: count,
  }));
}

function buildRecurringDrafts(spec: CommitmentSpec, horizonEnd: Date): OccurrenceDraft[] {
  if (!spec.recurrenceRule) {
    throw new Error("Un compromiso recurrente necesita la regla de recurrencia.");
  }

  const rule = RRule.fromString(spec.recurrenceRule);
  rule.options.dtstart = spec.startDate;

  const end = spec.endDate && spec.endDate < horizonEnd ? spec.endDate : horizonEnd;
  const dueDates = rule.between(spec.startDate, end, true);

  return dueDates.map((dueDate) => ({
    dueDate,
    amount: money(new Decimal(spec.totalAmount), spec.currency),
    installmentNumber: null,
    installmentTotal: null,
  }));
}

/**
 * Divide un total en cuotas iguales redondeadas hacia abajo; la última
 * absorbe el resto, de modo que Σ cuotas == total exacto. Ej. 10000 / 3 a
 * 2 decimales → [3333.33, 3333.33, 3333.34].
 */
export function splitIntoInstallments(
  total: Decimal,
  count: number,
  decimals: number,
): Decimal[] {
  if (count < 1) throw new Error("La cantidad de cuotas tiene que ser mayor a cero.");
  if (count === 1) return [total];

  const base = total.dividedBy(count).toDecimalPlaces(decimals, Decimal.ROUND_DOWN);
  const parts: Decimal[] = [];
  let used = new Decimal(0);

  for (let i = 0; i < count - 1; i++) {
    parts.push(base);
    used = used.plus(base);
  }
  parts.push(total.minus(used));

  return parts;
}

/**
 * Regla RRULE mensual para un compromiso recurrente, anclada al día del mes
 * en que arranca (ej. arranca el 15 → "FREQ=MONTHLY;BYMONTHDAY=15"). Sin
 * COUNT: el fin se controla con endDate o con el horizonte de generación.
 */
export function buildMonthlyRecurrenceRule(startDate: Date): string {
  return `FREQ=MONTHLY;BYMONTHDAY=${startDate.getUTCDate()}`;
}
