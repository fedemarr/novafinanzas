import { formatMoney, money } from "@/lib/domain/money";
import { COMMITMENT_KIND_LABELS } from "@/features/commitments/schemas";
import type { TodayView } from "../queries";

interface CurrencyMeta {
  symbol: string;
  decimals: number;
}

interface TodayViewProps {
  view: TodayView;
  currencyMetaByCode: Map<string, CurrencyMeta>;
}

const dayFormatter = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" });

export function TodayViewComponent({ view, currencyMetaByCode }: TodayViewProps) {
  const baseMeta = currencyMetaByCode.get(view.baseCurrencyCode) ?? {
    symbol: view.baseCurrencyCode,
    decimals: 2,
  };
  const { safeToSpend, payday } = view;
  const deficitAbs = money(safeToSpend.total.amount.abs(), view.baseCurrencyCode);

  const rows: { label: string; value: ReturnType<typeof formatMoney>; muted?: boolean }[] = [
    { label: "Disponible", value: formatMoney(safeToSpend.available, baseMeta) },
    { label: "Ingresos previstos", value: formatMoney(safeToSpend.incomeBeforePayday, baseMeta), muted: true },
    { label: "Comprometido", value: `−${formatMoney(safeToSpend.committedBeforePayday, baseMeta)}` },
    { label: "Aporte objetivos", value: `−${formatMoney(safeToSpend.goalContributionForCycle, baseMeta)}` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border p-5">
        <p className="text-sm text-muted-foreground">
          Safe-to-spend · próximo cobro {dayFormatter.format(payday.nextPayday)} (en{" "}
          {payday.daysUntilPayday} días)
        </p>
        {safeToSpend.isDeficit ? (
          <>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-red-600 dark:text-red-400">
              −{formatMoney(deficitAbs, baseMeta)}
            </p>
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              Estás en déficit: te falta {formatMoney(deficitAbs, baseMeta)} para llegar al
              próximo cobro. Revisá gastos o compromisos.
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {formatMoney(safeToSpend.total, baseMeta)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              ≈ {formatMoney(safeToSpend.daily, baseMeta)} por día hasta el próximo cobro
            </p>
          </>
        )}

        <dl className="mt-4 flex flex-col gap-1 border-t pt-4 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <dt className={row.muted ? "text-muted-foreground" : undefined}>{row.label}</dt>
              <dd className="font-medium tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {view.missingRateFor.length > 0 ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Faltan rates para consolidar: {view.missingRateFor.join(", ")}. Lo que está en esas
          monedas no se cuenta en el safe-to-spend.
        </p>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Próximos compromisos</h2>
        {view.upcomingOccurrences.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No hay compromisos pendientes.
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {view.upcomingOccurrences.map((occ) => (
              <li key={occ.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{occ.commitmentName}</span>
                  <span className="text-xs text-muted-foreground">
                    {COMMITMENT_KIND_LABELS[occ.commitmentKind]} · {occ.accountName} ·{" "}
                    {dayFormatter.format(occ.dueDate)}
                  </span>
                </div>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatMoney(
                    occ.amount,
                    currencyMetaByCode.get(occ.amount.currency) ?? {
                      symbol: occ.amount.currency,
                      decimals: 2,
                    },
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
