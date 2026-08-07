import Link from "next/link";
import { formatMoney } from "@/lib/domain/money";
import type { AccountsOverview } from "../queries";
import { ACCOUNT_TYPE_LABELS, type ACCOUNT_TYPES } from "../schemas";

interface CurrencyMeta {
  symbol: string;
  decimals: number;
}

interface AccountsOverviewProps {
  overview: AccountsOverview;
  currencyMetaByCode: Map<string, CurrencyMeta>;
}

export function AccountsOverviewView({ overview, currencyMetaByCode }: AccountsOverviewProps) {
  const baseMeta = currencyMetaByCode.get(overview.baseCurrencyCode) ?? {
    symbol: overview.baseCurrencyCode,
    decimals: 2,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">Total consolidado</p>
        <p className="text-3xl font-semibold tabular-nums">
          {formatMoney(overview.total, baseMeta)}
        </p>
        {overview.missingRateFor.length > 0 ? (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            Faltan rates para consolidar: {overview.missingRateFor.join(", ")}. Esas cuentas no
            están sumadas al total.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        {overview.accounts.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Todavía no cargaste ninguna cuenta.
          </p>
        ) : (
          overview.accounts.map((account) => {
            const meta = currencyMetaByCode.get(account.currencyCode) ?? {
              symbol: account.currencyCode,
              decimals: 2,
            };
            return (
              <Link
                key={account.id}
                href={`/accounts/${account.id}/edit`}
                className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <div>
                  <p className="font-medium">
                    {account.name}
                    {account.isSavings ? (
                      <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                        Ahorro
                      </span>
                    ) : null}
                    {!account.isActive ? (
                      <span className="ml-2 text-xs text-muted-foreground">(inactiva)</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ACCOUNT_TYPE_LABELS[account.type as (typeof ACCOUNT_TYPES)[number]]} ·{" "}
                    {account.currencyCode}
                    {account.isLiquid ? " · líquida" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium tabular-nums">{formatMoney(account.balance, meta)}</p>
                  {account.balanceInBaseCurrency && account.currencyCode !== overview.baseCurrencyCode ? (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      ≈ {formatMoney(account.balanceInBaseCurrency, baseMeta)}
                    </p>
                  ) : null}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
