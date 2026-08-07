"use client";

import Link from "next/link";
import { formatMoney, money } from "@/lib/domain/money";
import { COMMITMENT_KIND_LABELS } from "../schemas";
import type { CommitmentWithNextOccurrence, TimelineMonth } from "../queries";

interface CurrencyMeta {
  symbol: string;
  decimals: number;
}

interface CommitmentsTimelineProps {
  commitments: CommitmentWithNextOccurrence[];
  months: TimelineMonth[];
  currencyMetaByCode: Map<string, CurrencyMeta>;
}

const monthFormatter = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" });
const dayFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" });

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return monthFormatter.format(date);
}

export function CommitmentsTimeline({
  commitments,
  months,
  currencyMetaByCode,
}: CommitmentsTimelineProps) {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Compromisos activos</h2>
        {commitments.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Todavía no cargaste ningún compromiso. Empezá por tu primera compra en cuotas.
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {commitments.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex min-w-0 flex-col">
                  <Link
                    href={`/commitments/${c.id}/edit`}
                    className="truncate font-medium hover:underline"
                  >
                    {c.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {COMMITMENT_KIND_LABELS[c.kind]} · {c.account.name}
                    {c.nextOccurrence
                      ? ` · próximo ${dayFormatter.format(c.nextOccurrence.dueDate)}`
                      : " · sin cuotas pendientes"}
                    {!c.isActive ? " · inactivo" : ""}
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  {c.nextOccurrence ? (
                    <p className="font-medium tabular-nums">
                      {formatMoney(
                        money(c.nextOccurrence.amount, c.currencyCode),
                        currencyMetaByCode.get(c.currencyCode) ?? {
                          symbol: c.currencyCode,
                          decimals: 2,
                        },
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">$0</p>
                  )}
                  {c.nextOccurrence?.installmentTotal ? (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      cuota {c.nextOccurrence.installmentNumber} de{" "}
                      {c.nextOccurrence.installmentTotal}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Próximos 12 meses</h2>
        {months.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No hay cuotas programadas en los próximos 12 meses.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {months.map((month) => (
              <li key={month.key} className="rounded-lg border">
                <div className="flex items-center justify-between border-b px-4 py-2">
                  <span className="text-sm font-semibold capitalize">{monthLabel(month.key)}</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {month.totals
                      .map((total) =>
                        formatMoney(
                          total,
                          currencyMetaByCode.get(total.currency) ?? {
                            symbol: total.currency,
                            decimals: 2,
                          },
                        ),
                      )
                      .join(" · ")}
                  </span>
                </div>
                <ul className="flex flex-col divide-y">
                  {month.entries.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-2">
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm">{entry.commitment.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {COMMITMENT_KIND_LABELS[entry.commitment.kind]} ·{" "}
                          {dayFormatter.format(entry.dueDate)}
                        </span>
                      </div>
                      <span className="shrink-0 text-sm font-medium tabular-nums">
                        {formatMoney(
                          money(entry.amount, entry.currencyCode),
                          currencyMetaByCode.get(entry.currencyCode) ?? {
                            symbol: entry.currencyCode,
                            decimals: 2,
                          },
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
