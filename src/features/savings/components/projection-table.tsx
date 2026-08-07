import { TrendingUp } from "lucide-react";
import { formatMoney, type Money } from "@/lib/domain/money";
import { averageMonthlySavings, projectSavings } from "@/lib/domain/savings-projection";
import { SavingsAccumulationChart } from "./savings-accumulation-chart";

interface CurrencyMeta {
  symbol: string;
  decimals: number;
}

interface ProjectionTableProps {
  monthlySaved: Record<string, Money[]>;
  currencyMetaByCode: Map<string, CurrencyMeta>;
  timeZone: string;
}

const PROJECTION_MONTHS = 12;

function nextMonthLabels(timeZone: string, count: number): string[] {
  const now = new Date();
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).format(now);
  const [year, month] = local.split("-").map(Number);

  const labels: string[] = [];
  for (let i = 1; i <= count; i++) {
    const date = new Date(Date.UTC(year, month - 1 + i, 1));
    const label = new Intl.DateTimeFormat("es-AR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
    labels.push(label.charAt(0).toUpperCase() + label.slice(1));
  }
  return labels;
}

export function ProjectionTable({ monthlySaved, currencyMetaByCode, timeZone }: ProjectionTableProps) {
  const currenciesWithSavings = Object.entries(monthlySaved).filter(
    ([, months]) => {
      const avg = averageMonthlySavings(months);
      return avg !== null && avg.amount.greaterThan(0);
    },
  );

  if (currenciesWithSavings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
        <TrendingUp className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Todavía no hay suficiente histórico para proyectar.
        </p>
        <p className="text-xs text-muted-foreground/70">
          Apartá plata durante al menos un mes y te mostramos cuánto vas a acumular.
        </p>
      </div>
    );
  }

  const labels = nextMonthLabels(timeZone, PROJECTION_MONTHS);

  return (
    <div className="flex flex-col gap-6">
      {currenciesWithSavings.map(([currency, months]) => {
        const meta = currencyMetaByCode.get(currency) ?? { symbol: currency, decimals: 2 };
        const fmt = (m: Money) => formatMoney(m, meta);
        const average = averageMonthlySavings(months)!;
        const projected = projectSavings(months, PROJECTION_MONTHS);

        return (
          <div key={currency}>
            <p className="mb-2 text-sm text-muted-foreground">
              Si seguís apartando <span className="font-medium text-foreground">{fmt(average)}</span> por
              mes…
            </p>
            <div className="mb-4 rounded-lg border bg-muted/20 p-3">
              <SavingsAccumulationChart
                symbol={meta.symbol}
                decimals={meta.decimals}
                currencyCode={currency}
                points={projected.map((month) => ({
                  label: labels[month.offset - 1],
                  cumulative: month.cumulative.toString(),
                }))}
              />
            </div>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-3 py-1.5 text-left font-medium">Mes</th>
                    <th className="px-3 py-1.5 text-right font-medium">Apartás</th>
                    <th className="px-3 py-1.5 text-right font-medium">Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {projected.map((month) => (
                    <tr key={month.offset} className="border-b last:border-b-0">
                      <td className="px-3 py-1.5">{labels[month.offset - 1]}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                        {fmt(month.expected)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                        {fmt(month.cumulative)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
