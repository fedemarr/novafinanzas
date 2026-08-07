"use client";

import Link from "next/link";
import { formatMoney, money } from "@/lib/domain/money";
import type { PlanillaChartData } from "../../chart-data";

const W = 640;
const H = 170;
const PAD_X = 14;
const PAD_TOP = 18;
const PAD_BOTTOM = 28;
const PLOT_W = W - PAD_X * 2;
const PLOT_H = H - PAD_TOP - PAD_BOTTOM;

interface MonthlyTrendProps {
  data: PlanillaChartData;
  /** Navega a la planilla de ese mes (key "YYYY-MM"). */
  monthHref: (key: string) => string;
}

function shortMonth(key: string): string {
  return new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: "UTC" })
    .format(new Date(`${key}-01T00:00:00.000Z`))
    .replace(".", "");
}

export function MonthlyTrend({ data, monthHref }: MonthlyTrendProps) {
  const points = data.trend;
  const max = Math.max(...points.map((p) => Number(p.total)), 1);
  const n = points.length;
  const step = n > 1 ? PLOT_W / (n - 1) : 0;
  const fmtAmount = (raw: string) =>
    formatMoney(money(raw, data.currencyCode), { symbol: data.symbol, decimals: data.decimals });

  const coords = points.map((p, i) => {
    const x = PAD_X + i * step;
    const y = PAD_TOP + PLOT_H - (Number(p.total) / max) * PLOT_H;
    return { x, y };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const areaPath =
    coords.length > 0
      ? `M ${coords[0].x} ${PAD_TOP + PLOT_H} ${linePath.slice(1)} L ${coords[coords.length - 1].x} ${PAD_TOP + PLOT_H} Z`
      : "";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full text-primary" role="img" aria-label="Gastos por mes">
      {areaPath ? (
        <path d={areaPath} fill="currentColor" opacity="0.12" />
      ) : null}
      {linePath ? (
        <path d={linePath} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      ) : null}

      {coords.map((c, i) => (
        <Link key={points[i].key} href={monthHref(points[i].key)}>
          <circle cx={c.x} cy={c.y} r={4} fill="var(--background)" stroke="currentColor" strokeWidth={2} className="cursor-pointer">
            <title>
              {points[i].label}: {fmtAmount(points[i].total)}
            </title>
          </circle>
        </Link>
      ))}

      {coords.map((c, i) => (
        <Link key={`label-${points[i].key}`} href={monthHref(points[i].key)}>
          <text
            x={c.x}
            y={H - 8}
            textAnchor="middle"
            className="cursor-pointer fill-muted-foreground text-[10px] hover:fill-foreground"
          >
            {shortMonth(points[i].key)}
          </text>
        </Link>
      ))}
    </svg>
  );
}
