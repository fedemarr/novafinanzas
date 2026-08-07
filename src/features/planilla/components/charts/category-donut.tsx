"use client";

import Link from "next/link";
import { formatMoney, money } from "@/lib/domain/money";
import { categoryColor, type PlanillaChartData } from "../../chart-data";

const SIZE = 168;
const STROKE = 26;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface CategoryDonutProps {
  data: PlanillaChartData;
  selectedCategoryId: string | null;
}

export function CategoryDonut({ data, selectedCategoryId }: CategoryDonutProps) {
  const total = Number(data.totalExpenses);

  if (data.categories.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Sin gastos este mes.
      </p>
    );
  }

  const categoryHref = (categoryId: string | null) =>
    data.baseHref + (categoryId ? `&cat=${encodeURIComponent(categoryId)}` : "");

  const rawLengths = data.categories.map((slice) =>
    total > 0 ? (Number(slice.total) / total) * CIRCUMFERENCE : 0,
  );
  const segments = data.categories.map((slice, index) => {
    const fraction = total > 0 ? Number(slice.total) / total : 0;
    const offset = -rawLengths.slice(0, index).reduce((a, b) => a + b, 0);
    const length = Math.max(rawLengths[index] - 2, 0);
    return { slice, index, fraction, length, offset };
  });

  const fmtAmount = (raw: string) =>
    formatMoney(money(raw, data.currencyCode), { symbol: data.symbol, decimals: data.decimals });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            stroke="var(--muted)"
          />
          {segments.map((seg) => (
            <Link key={seg.slice.id} href={categoryHref(seg.slice.id)}>
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                strokeWidth={STROKE}
                stroke={categoryColor(seg.slice, seg.index)}
                strokeDasharray={`${seg.length} ${CIRCUMFERENCE - seg.length}`}
                strokeDashoffset={seg.offset}
                className="cursor-pointer transition-opacity hover:opacity-75"
              >
                <title>
                  {seg.slice.name}: {fmtAmount(seg.slice.total)} ({Math.round(seg.fraction * 100)}%)
                </title>
              </circle>
            </Link>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Gastos</p>
          <p className="max-w-28 truncate text-lg font-semibold tabular-nums">
            {fmtAmount(data.totalExpenses)}
          </p>
        </div>
      </div>

      <ul className="flex w-full flex-col gap-1 text-sm sm:max-w-64">
        {segments.map((seg) => {
          const selected = selectedCategoryId === seg.slice.id;
          return (
            <li key={seg.slice.id}>
              <Link
                href={categoryHref(selected ? null : seg.slice.id)}
                className={
                  "flex items-center justify-between gap-2 rounded-md px-2 py-1 transition-colors " +
                  (selected ? "bg-muted font-medium ring-1 ring-foreground/10" : "hover:bg-muted/60")
                }
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: categoryColor(seg.slice, seg.index) }}
                  />
                  {seg.slice.icon ? <span>{seg.slice.icon}</span> : null}
                  <span className="truncate">{seg.slice.name}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {fmtAmount(seg.slice.total)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
