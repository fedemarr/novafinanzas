import { prisma } from "@/lib/db/prisma";
import Decimal from "decimal.js";

// ============================================================================
// Planilla del mes (v2): la pantalla principal. Grilla tipo hoja de cálculo
// con filas = días y columnas = categorías, para UNA moneda a la vez
// (toggle ARS/USD) — cada celda es un solo número, sin mezclar monedas.
//
// El mes se define en la zona horaria del usuario (User.timezone), no en UTC:
// las queries usan una ventana UTC ampliada ±2 días y filtran en JS por la
// fecha local — simple y correcto para volúmenes personales.
// ============================================================================

export interface MonthKey {
  year: number;
  /** 1-12 */
  month: number;
}

export function monthKeyToString(key: MonthKey): string {
  return `${key.year}-${String(key.month).padStart(2, "0")}`;
}

/** Fecha local (timeZone) de un instante UTC, como "YYYY-MM-DD". */
export function localDateString(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function parseMonthKey(
  raw: string | null | undefined,
  timeZone: string,
  now = new Date(),
): MonthKey {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [year, month] = raw.split("-").map(Number);
    if (month >= 1 && month <= 12) return { year, month };
  }
  const current = localDateString(now, timeZone).split("-").map(Number);
  return { year: current[0], month: current[1] };
}

export interface GridCategoryColumn {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  total: Decimal;
}

export interface GridRow {
  day: number;
  /** Celda por columna (key = GridCategoryColumn.id). Solo días con actividad. */
  cells: Map<string, Decimal>;
  dayTotal: Decimal;
}

export interface Planilla {
  key: MonthKey;
  label: string;
  daysInMonth: number;
  currencyCode: string;
  /** Columnas = categorías con al menos un gasto en el mes, ordenadas por total desc. */
  categories: GridCategoryColumn[];
  /** Solo los días que tienen gastos (celdas vacías no suman ruido). */
  rows: GridRow[];
  totalExpenses: Decimal;
  totalIncome: Decimal;
  difference: Decimal;
  /** Monedas con movimientos en el mes (para avisar del toggle). */
  availableCurrencies: string[];
}

const NO_CATEGORY_COLUMN_ID = "__none__";
const MARGIN_MS = 2 * 24 * 60 * 60 * 1000;

export async function getPlanilla(
  userId: string,
  key: MonthKey,
  currencyCode: string,
  timeZone: string,
): Promise<Planilla> {
  const monthPrefix = monthKeyToString(key);

  const windowStart = new Date(Date.UTC(key.year, key.month - 1, 1));
  const windowEnd = new Date(Date.UTC(key.year, key.month, 1));
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      status: "CONFIRMED",
      type: { in: ["EXPENSE", "INCOME"] },
      occurredAt: { gte: new Date(windowStart.getTime() - MARGIN_MS), lt: new Date(windowEnd.getTime() + MARGIN_MS) },
    },
    include: { category: { select: { id: true, name: true, icon: true, color: true } } },
  });

  const availableCurrencies = [...new Set(transactions.map((tx) => tx.currencyCode))];

  const inMonth = transactions.filter(
    (tx) =>
      tx.currencyCode === currencyCode &&
      localDateString(tx.occurredAt, timeZone).startsWith(monthPrefix),
  );

  const columns = new Map<string, GridCategoryColumn>();
  const rowsByDay = new Map<number, Map<string, Decimal>>();
  let totalExpenses = new Decimal(0);
  let totalIncome = new Decimal(0);

  for (const tx of inMonth) {
    const localDate = localDateString(tx.occurredAt, timeZone);
    const day = Number(localDate.slice(8, 10));
    const catKey = tx.categoryId ?? NO_CATEGORY_COLUMN_ID;

    let column = columns.get(catKey);
    if (!column) {
      column = {
        id: catKey,
        name: tx.category?.name ?? "Sin categoría",
        icon: tx.category?.icon ?? null,
        color: tx.category?.color ?? null,
        total: new Decimal(0),
      };
      columns.set(catKey, column);
    }

    if (tx.type === "INCOME") {
      totalIncome = totalIncome.plus(tx.amount);
      continue;
    }
    totalExpenses = totalExpenses.plus(tx.amount);

    let dayCells = rowsByDay.get(day);
    if (!dayCells) {
      dayCells = new Map();
      rowsByDay.set(day, dayCells);
    }
    const current = dayCells.get(catKey) ?? new Decimal(0);
    dayCells.set(catKey, current.plus(tx.amount));
    column.total = column.total.plus(tx.amount);
  }

  const orderedColumns = [...columns.values()].sort((a, b) => b.total.comparedTo(a.total));

  const rows: GridRow[] = [...rowsByDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, cells]) => {
      let dayTotal = new Decimal(0);
      for (const value of cells.values()) dayTotal = dayTotal.plus(value);
      return { day, cells, dayTotal };
    });

  const daysInMonth = new Date(Date.UTC(key.year, key.month, 0)).getUTCDate();

  return {
    key,
    label: monthLabel(key),
    daysInMonth,
    currencyCode,
    categories: orderedColumns,
    rows,
    totalExpenses,
    totalIncome,
    difference: totalIncome.minus(totalExpenses),
    availableCurrencies,
  };
}

function monthLabel(key: MonthKey): string {
  const label = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(key.year, key.month - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export interface MonthTotal {
  key: MonthKey;
  /** "ago 2026" */
  label: string;
  total: Decimal;
}

/**
 * Total gastado por mes (solo EXPENSE), de más viejo a más nuevo, para los
 * últimos `months` meses terminando en `key`. Misma lógica de zona horaria
 * que getPlanilla.
 */
export async function getMonthlyTotals(
  userId: string,
  currencyCode: string,
  timeZone: string,
  key: MonthKey,
  months = 6,
): Promise<MonthTotal[]> {
  const startMonth = new Date(Date.UTC(key.year, key.month - months, 1));
  const windowStart = new Date(startMonth.getTime() - MARGIN_MS);
  const windowEnd = new Date(Date.UTC(key.year, key.month, 1));

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      status: "CONFIRMED",
      type: "EXPENSE",
      currencyCode,
      occurredAt: { gte: windowStart, lt: windowEnd },
    },
    select: { amount: true, occurredAt: true },
  });

  const byPrefix = new Map<string, Decimal>();
  for (const tx of transactions) {
    const prefix = localDateString(tx.occurredAt, timeZone).slice(0, 7);
    byPrefix.set(prefix, (byPrefix.get(prefix) ?? new Decimal(0)).plus(tx.amount));
  }

  const result: MonthTotal[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const monthDate = new Date(Date.UTC(key.year, key.month - 1 - i, 1));
    const prefix = monthKeyToString({ year: monthDate.getUTCFullYear(), month: monthDate.getUTCMonth() + 1 });
    result.push({
      key: { year: monthDate.getUTCFullYear(), month: monthDate.getUTCMonth() + 1 },
      label: monthLabel({ year: monthDate.getUTCFullYear(), month: monthDate.getUTCMonth() + 1 }),
      total: byPrefix.get(prefix) ?? new Decimal(0),
    });
  }
  return result;
}
