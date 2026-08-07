"use client";

import { formatMoney, money } from "@/lib/domain/money";

const W = 640;
const H = 160;
const PAD_X = 14;
const PAD_TOP = 14;
const PAD_BOTTOM = 26;
const PLOT_W = W - PAD_X * 2;
const PLOT_H = H - PAD_TOP - PAD_BOTTOM;

export interface AccumulationPoint {
  label: string;
  cumulative: string;
}

interface SavingsAccumulationChartProps {
  symbol: string;
  decimals: number;
  currencyCode: string;
  points: AccumulationPoint[];
}

function shortMonth(label: string): string {
  return label.split(" ")[0];
}

export function SavingsAccumulationChart({
  symbol,
  decimals,
  currencyCode,
  points,
}: SavingsAccumulationChartProps) {
  const values = points.map((p) => Number(p.cumulative));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const n = points.length;
  const step = n > 1 ? PLOT_W / (n - 1) : 0;
  const fmt = (raw: string) =>
    formatMoney(money(raw, currencyCode), { symbol, decimals });

  const coords = points.map((p, i) => ({
    x: PAD_X + i * step,
    y: PAD_TOP + PLOT_H - ((Number(p.cumulative) - min) / range) * PLOT_H,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const areaPath =
    coords.length > 0
      ? `M ${coords[0].x} ${PAD_TOP + PLOT_H} ${linePath.slice(1)} L ${coords[coords.length - 1].x} ${PAD_TOP + PLOT_H} Z`
      : "";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full text-emerald-500"
      role="img"
      aria-label="Acumulado proyectado del ahorro"
    >
      {areaPath ? <path d={areaPath} fill="currentColor" opacity="0.14" /> : null}
      {linePath ? (
        <path
          d={linePath}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}

      {coords.map((c, i) => (
        <circle
          key={points[i].label}
          cx={c.x}
          cy={c.y}
          r={3.5}
          fill="var(--background)"
          stroke="currentColor"
          strokeWidth={2}
        >
          <title>
            {points[i].label}: {fmt(points[i].cumulative)}
          </title>
        </circle>
      ))}

      {coords.map((c, i) => (
        <text
          key={`label-${points[i].label}`}
          x={c.x}
          y={H - 8}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          {shortMonth(points[i].label)}
        </text>
      ))}
    </svg>
  );
}
