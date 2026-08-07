"use client";

import { formatMoney, money } from "@/lib/domain/money";
import type { PlanillaChartData } from "../../chart-data";

const W = 640;
const H = 150;
const PAD_X = 6;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;
const PLOT_W = W - PAD_X * 2;
const PLOT_H = H - PAD_TOP - PAD_BOTTOM;

interface DailyBarsProps {
  data: PlanillaChartData;
}

export function DailyBars({ data }: DailyBarsProps) {
  const days = data.days;
  if (days.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sin gastos este mes.</p>;
  }

  const max = Math.max(...days.map((d) => Number(d.total)), 1);
  const slot = PLOT_W / days.length;
  const barWidth = Math.max(slot * 0.6, 2);
  const fmtAmount = (raw: string) =>
    formatMoney(money(raw, data.currencyCode), { symbol: data.symbol, decimals: data.decimals });
  const labelStep = Math.max(1, Math.ceil(days.length / 10));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Gastos por día">
      <defs>
        <linearGradient id="daily-bar-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.25" />
        </linearGradient>
      </defs>

      {days.map((day, i) => {
        const value = Number(day.total);
        const height = (value / max) * PLOT_H;
        const x = PAD_X + i * slot + (slot - barWidth) / 2;
        const y = PAD_TOP + PLOT_H - height;
        return (
          <rect
            key={day.day}
            x={x}
            y={y}
            width={barWidth}
            height={Math.max(height, 1)}
            rx={2}
            fill="url(#daily-bar-gradient)"
            className="transition-opacity hover:opacity-70"
          >
            <title>
              Día {day.day}: {fmtAmount(day.total)}
            </title>
          </rect>
        );
      })}

      {days.map((day, i) => {
        if ((i + 1) % labelStep !== 0) return null;
        const x = PAD_X + i * slot + slot / 2;
        return (
          <text
            key={`label-${day.day}`}
            x={x}
            y={H - 6}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px]"
          >
            {day.day}
          </text>
        );
      })}
    </svg>
  );
}
