import Link from "next/link";
import type Decimal from "decimal.js";
import type { Planilla } from "../queries";
import { formatMoney, money } from "@/lib/domain/money";

interface CurrencyMeta {
  symbol: string;
  decimals: number;
}

interface MonthGridProps {
  planilla: Planilla;
  currencyMeta: CurrencyMeta;
  /** Si viene, la grilla muestra solo esa categoría (filtro del donut). */
  filterCategoryId?: string | null;
  /** Si viene, los días son links que abren los movimientos de ese día. */
  dayHref?: (day: number) => string;
}

export function MonthGrid({ planilla, currencyMeta, filterCategoryId, dayHref }: MonthGridProps) {
  const columns = filterCategoryId
    ? planilla.categories.filter((c) => c.id === filterCategoryId)
    : planilla.categories;

  const rows = filterCategoryId
    ? planilla.rows.filter((r) => r.cells.has(filterCategoryId))
    : planilla.rows;

  const fmt = (value: Decimal) =>
    formatMoney(money(value, planilla.currencyCode), currencyMeta);

  const grandTotal = filterCategoryId
    ? columns[0]?.total ?? planilla.totalExpenses
    : planilla.totalExpenses;

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-6">
        <p className="text-sm text-muted-foreground">
          {filterCategoryId
            ? "Ningún día de este mes tiene gastos en esa categoría."
            : "Todavía no hay gastos cargados este mes."}
        </p>
        {!filterCategoryId ? (
          <p className="text-xs text-muted-foreground/70">
            Usá el formulario de arriba para anotar tu primer gasto.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
            <th className="px-2 py-1.5 text-left font-medium">Día</th>
            {columns.map((cat) => (
              <th key={cat.id} className="px-2 py-1.5 text-right font-medium" title={cat.name}>
                <span className="inline-flex max-w-28 items-center gap-1 truncate">
                  {cat.icon ? (
                    <span style={{ color: cat.color ?? undefined }}>{cat.icon}</span>
                  ) : null}
                  <span className="truncate">{cat.name}</span>
                </span>
              </th>
            ))}
            <th className="px-2 py-1.5 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.day} className="border-b last:border-b-0">
              <td className="px-2 py-1 tabular-nums text-muted-foreground">
                {dayHref ? (
                  <Link
                    href={dayHref(row.day)}
                    className="inline-flex size-6 items-center justify-center rounded-md tabular-nums hover:bg-muted hover:text-foreground"
                    aria-label={`Movimientos del día ${row.day}`}
                  >
                    {row.day}
                  </Link>
                ) : (
                  row.day
                )}
              </td>
              {columns.map((cat) => {
                const value = row.cells.get(cat.id);
                return (
                  <td key={cat.id} className="px-2 py-1 text-right tabular-nums">
                    {value ? fmt(value) : <span className="text-muted-foreground/30">·</span>}
                  </td>
                );
              })}
              <td className="px-2 py-1 text-right font-medium tabular-nums">
                {fmt(row.dayTotal)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/40 font-medium">
            <td className="px-2 py-1.5">Total</td>
            {columns.map((cat) => (
              <td key={cat.id} className="px-2 py-1.5 text-right tabular-nums">
                {fmt(cat.total)}
              </td>
            ))}
            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
