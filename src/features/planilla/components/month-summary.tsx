import { ArrowUpRight, PiggyBank, Wallet } from "lucide-react";
import type { Planilla } from "../queries";
import { formatMoney, money } from "@/lib/domain/money";

interface CurrencyMeta {
  symbol: string;
  decimals: number;
}

interface MonthSummaryProps {
  planilla: Planilla;
  currencyMeta: CurrencyMeta;
}

export function MonthSummary({ planilla, currencyMeta }: MonthSummaryProps) {
  const fmt = (value: import("decimal.js").Decimal) =>
    formatMoney(money(value, planilla.currencyCode), currencyMeta);
  const difference = planilla.difference;
  const isPositive = difference.greaterThanOrEqualTo(0);

  const cards = [
    {
      label: "Gastos del mes",
      value: fmt(planilla.totalExpenses),
      icon: Wallet,
      iconClass: "bg-destructive/10 text-destructive",
    },
    {
      label: "Ingresos del mes",
      value: fmt(planilla.totalIncome),
      icon: ArrowUpRight,
      iconClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Diferencia",
      value: (isPositive ? "+" : "") + fmt(difference),
      icon: PiggyBank,
      iconClass: isPositive
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        : "bg-destructive/10 text-destructive",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex items-center gap-3 rounded-xl border bg-card p-4 ring-1 ring-foreground/5"
        >
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${card.iconClass}`}>
            <card.icon className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="truncate text-xl font-semibold tabular-nums">{card.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
