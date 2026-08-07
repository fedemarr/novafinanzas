import { PiggyBank } from "lucide-react";
import { formatMoney } from "@/lib/domain/money";
import type { Money } from "@/lib/domain/money";
import type { SavingsOverview } from "../queries";

interface CurrencyMeta {
  symbol: string;
  decimals: number;
}

interface SavingsOverviewProps {
  overview: SavingsOverview;
  currencyMetaByCode: Map<string, CurrencyMeta>;
}

export function SavingsOverviewView({ overview, currencyMetaByCode }: SavingsOverviewProps) {
  const metaFor = (m: Money) => currencyMetaByCode.get(m.currency) ?? { symbol: m.currency, decimals: 2 };
  const fmt = (m: Money) => formatMoney(m, metaFor(m));

  if (overview.accounts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
        <PiggyBank className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Todavía no tenés cuentas de ahorro.
        </p>
        <p className="text-xs text-muted-foreground/70">
          En Cuentas, marcá una cuenta como &quot;es de ahorro&quot; y empezá a apartar plata
          acá.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {overview.totalsByCurrency.map((total) => (
          <div
            key={total.currency}
            className="flex items-center gap-3 rounded-xl border bg-card p-4 ring-1 ring-foreground/5"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <PiggyBank className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Apartado total</p>
              <p className="truncate text-xl font-semibold tabular-nums">
                {fmt(total)} <span className="text-sm font-normal text-muted-foreground">{total.currency}</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Cuentas de ahorro</h2>
        <div className="flex flex-col gap-2">
          {overview.accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <p className="font-medium">{account.name}</p>
              <p className="font-medium tabular-nums">{fmt(account.balance)}</p>
            </div>
          ))}
        </div>
      </div>

      {overview.recentTransfers.length > 0 ? (
        <div>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Últimos apartados</h2>
          <div className="flex flex-col gap-1">
            {overview.recentTransfers.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <p className="truncate text-muted-foreground">
                  {tx.fromName} → <span className="text-foreground">{tx.toName}</span>
                  <span className="ml-2 text-xs text-muted-foreground/70">
                    {new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(tx.occurredAt)}
                  </span>
                </p>
                <p className="font-medium tabular-nums">{fmt(tx.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
