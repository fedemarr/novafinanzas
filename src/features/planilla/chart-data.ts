import type { MonthTotal, Planilla } from "./queries";

// ============================================================================
// Datos de los charts del dashboard. Los charts viven en el cliente, así que
// acá serializamos los Decimal de Prisma a strings (JSON no lleva Decimal).
// ============================================================================

export interface CategorySlice {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  total: string;
}

export interface DayBar {
  day: number;
  total: string;
}

export interface TrendPoint {
  /** "YYYY-MM" */
  key: string;
  label: string;
  total: string;
}

export interface PlanillaChartData {
  symbol: string;
  decimals: number;
  currencyCode: string;
  categories: CategorySlice[];
  totalExpenses: string;
  totalIncome: string;
  difference: string;
  days: DayBar[];
  trend: TrendPoint[];
}

export function buildPlanillaChartData(
  planilla: Planilla,
  trend: MonthTotal[],
  symbol: string,
  decimals: number,
): PlanillaChartData {
  return {
    symbol,
    decimals,
    currencyCode: planilla.currencyCode,
    categories: planilla.categories.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      total: c.total.toString(),
    })),
    totalExpenses: planilla.totalExpenses.toString(),
    totalIncome: planilla.totalIncome.toString(),
    difference: planilla.difference.toString(),
    days: planilla.rows.map((r) => ({ day: r.day, total: r.dayTotal.toString() })),
    trend: trend.map((t) => ({
      key: `${t.key.year}-${String(t.key.month).padStart(2, "0")}`,
      label: t.label,
      total: t.total.toString(),
    })),
  };
}

/** Paleta de respaldo cuando una categoría no tiene color propio. */
export const CHART_PALETTE = [
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#14b8a6",
];

export function categoryColor(slice: { color: string | null }, index: number): string {
  return slice.color ?? CHART_PALETTE[index % CHART_PALETTE.length];
}
