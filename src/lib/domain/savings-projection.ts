import type Decimal from "decimal.js";
import { addMoney, money, type Money } from "./money";

// ============================================================================
// Proyección de ahorro (v2 simplificado): "si sigo apartando lo mismo que
// en los últimos meses, ¿cuánto acumulo mes a mes?". Puro motor, sin DB:
// la capa de queries le pasa los montos apartados por mes cerrado y la
// cantidad de meses a proyectar. Todo en la misma moneda (invariante #2).
// ============================================================================

export interface ProjectedMonth {
  /** N° de mes hacia adelante, arrancando en 1. */
  offset: number;
  /** Aporte esperado de ese mes (promedio histórico). */
  expected: Money;
  /** Total acumulado al cierre de ese mes. */
  cumulative: Money;
}

/**
 * Promedio de los montos apartados por mes. `null` si no hay histórico —
 * sin al menos un mes cerrado no hay base para proyectar.
 */
export function averageMonthlySavings(monthlySavings: Money[]): Money | null {
  if (monthlySavings.length === 0) return null;
  const first = monthlySavings[0];
  let sum: Decimal = first.amount;
  for (let i = 1; i < monthlySavings.length; i++) {
    const item = monthlySavings[i];
    if (item.currency !== first.currency) {
      throw new Error(
        `No se puede promediar ${first.currency} con ${item.currency} sin convertir primero.`,
      );
    }
    sum = sum.plus(item.amount);
  }
  return money(sum.div(monthlySavings.length), first.currency);
}

/**
 * Proyecta `months` meses hacia adelante con el promedio de los montos
 * apartados. Devuelve `[]` si no hay histórico. Los montos tienen que ser
 * de la misma moneda.
 */
export function projectSavings(monthlySavings: Money[], months: number): ProjectedMonth[] {
  if (months < 1) {
    throw new Error("La cantidad de meses a proyectar tiene que ser mayor o igual a 1.");
  }
  const average = averageMonthlySavings(monthlySavings);
  if (!average) return [];

  const result: ProjectedMonth[] = [];
  let cumulative = money("0", average.currency);
  for (let offset = 1; offset <= months; offset++) {
    cumulative = addMoney(cumulative, average);
    result.push({ offset, expected: average, cumulative });
  }
  return result;
}
