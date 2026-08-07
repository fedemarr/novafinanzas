import Decimal from "decimal.js";
import { type Money, addMoney, money, subtractMoney } from "./money";

// ============================================================================
// Motor Safe-to-Spend (M3) — PROJECT.md 5.1. Responde "¿cuánto puedo gastar
// hoy?". Puro: recibe todo en la moneda base (la conversión la hace la capa
// de datos con el rate vigente, invariantes #3 y #4) y solo hace aritmética.
//
//   disponible          = Σ balances de cuentas isLiquid = true
//   ingresosPrevistos   = Σ ingresos recurrentes con fecha < próximo cobro
//   comprometido        = Σ CommitmentOccurrence SCHEDULED con dueDate < cobro
//   aporteObjetivos     = Σ monthlyContribution prorrateado por días del ciclo
//   díasRestantes       = días hasta el próximo cobro (payCycleDay)
//
//   safeToSpendTotal  = disponible + ingresos - comprometido - aporte
//   safeToSpendDiario = total / díasRestantes
//
// Casos borde (PROJECT.md): sin ingreso recurrente cargado (ingresos = 0),
// safe-to-spend negativo (se muestra el déficit, no se clampa a cero),
// primer mes sin histórico (no usa historial).
// ============================================================================

const MS_PER_DAY = 86_400_000;

/** La "Hoy" solo muestra déficit o no — no redondea el número de días. */
export interface SafeToSpendInputs {
  available: Money;
  incomeBeforePayday: Money;
  committedBeforePayday: Money;
  goalContributionForCycle: Money;
  /** >= 1. El próximo cobro es estrictamente futuro, nunca hoy. */
  daysUntilPayday: number;
}

export interface SafeToSpendResult {
  total: Money;
  daily: Money;
  isDeficit: boolean;
}

export function computeSafeToSpend(inputs: SafeToSpendInputs): SafeToSpendResult {
  if (inputs.daysUntilPayday < 1) {
    throw new Error("El próximo cobro tiene que estar al menos a 1 día.");
  }

  let total = addMoney(inputs.available, inputs.incomeBeforePayday);
  total = subtractMoney(total, inputs.committedBeforePayday);
  total = subtractMoney(total, inputs.goalContributionForCycle);

  const daily = money(total.amount.dividedBy(inputs.daysUntilPayday), total.currency);

  return {
    total,
    daily,
    isDeficit: total.amount.isNegative(),
  };
}

/**
 * Prorrateo del aporte mensual de un objetivo a los días que quedan del
 * ciclo. Si el ciclo tiene 31 días y quedan 25, el aporte de este ciclo es
 * monthly × 25/31 — así el safe-to-spend diario descuenta lo mismo por día
 * (monthly/31) sin importar en qué día del ciclo estés.
 */
export function prorateGoalContribution(
  monthly: Money,
  daysRemaining: number,
  cycleDays: number,
  decimals: number,
): Money {
  if (daysRemaining < 1) {
    throw new Error("El próximo cobro tiene que estar al menos a 1 día.");
  }
  if (cycleDays < 1) {
    throw new Error("El ciclo de cobro tiene que durar al menos 1 día.");
  }
  const ratio = new Decimal(daysRemaining).dividedBy(cycleDays);
  const amount = monthly.amount.times(ratio).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
  return money(amount, monthly.currency);
}

export interface PaydayInfo {
  lastPayday: Date;
  nextPayday: Date;
  /** Días de `from` (hoy) hasta el próximo cobro. Siempre >= 1. */
  daysUntilPayday: number;
  /** Duración del ciclo actual (días entre el último y el próximo cobro). */
  cycleDays: number;
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

function clampDay(year: number, month0: number, day: number): number {
  return Math.min(day, daysInMonth(year, month0));
}

function paydayOfMonth(year: number, month0: number, payCycleDay: number): Date {
  return new Date(Date.UTC(year, month0, clampDay(year, month0, payCycleDay)));
}

/**
 * Calcula la info de cobro. El próximo cobro es estrictamente posterior a
 * `from` (si hoy ES el día de cobro, el próximo es el mes que viene). El día
 * de cobro se satura al fin de mes (31 → 28 en febrero).
 */
export function paydayInfo(payCycleDay: number, from: Date): PaydayInfo {
  if (!Number.isInteger(payCycleDay) || payCycleDay < 1 || payCycleDay > 31) {
    throw new Error("El día de cobro tiene que ser un entero entre 1 y 31.");
  }

  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const thisMonthPayday = paydayOfMonth(y, m, payCycleDay);

  let nextPayday: Date;
  if (thisMonthPayday.getTime() > from.getTime()) {
    nextPayday = thisMonthPayday;
  } else {
    nextPayday = paydayOfMonth(y, m + 1, payCycleDay);
  }

  let lastPayday: Date;
  if (thisMonthPayday.getTime() <= from.getTime()) {
    lastPayday = thisMonthPayday;
  } else {
    lastPayday = paydayOfMonth(y, m - 1, payCycleDay);
  }

  const daysUntilPayday = Math.round((nextPayday.getTime() - from.getTime()) / MS_PER_DAY);
  const cycleDays = Math.round((nextPayday.getTime() - lastPayday.getTime()) / MS_PER_DAY);

  return { lastPayday, nextPayday, daysUntilPayday, cycleDays };
}
