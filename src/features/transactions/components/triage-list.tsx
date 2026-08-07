import { formatMoney, money } from "@/lib/domain/money";
import { buttonVariants } from "@/components/ui/button";
import { TRANSACTION_TYPE_LABELS } from "../schemas";
import { confirmTransaction, ignoreTransaction } from "../actions";
import type { PendingReviewTransaction } from "../queries";

interface CurrencyMeta {
  symbol: string;
  decimals: number;
}

interface TriageListProps {
  pending: PendingReviewTransaction[];
  categories: { id: string; name: string }[];
  currencyMetaByCode: Map<string, CurrencyMeta>;
}

const dateFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" });

// Triage (M4): cada transacción que entró por mail espera confirmación.
// Una decisión por fila: categoría + confirmar, o descartar. Nada más.
export function TriageList({ pending, categories, currencyMetaByCode }: TriageListProps) {
  if (pending.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-muted-foreground">
        Para revisar <span className="font-normal">({pending.length})</span>
      </h2>
      <ul className="flex flex-col divide-y rounded-lg border">
        {pending.map((tx) => {
          const meta = currencyMetaByCode.get(tx.currencyCode) ?? {
            symbol: tx.currencyCode,
            decimals: 2,
          };
          return (
            <li key={tx.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {tx.merchantRaw ?? tx.description ?? TRANSACTION_TYPE_LABELS[tx.type]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {dateFormatter.format(tx.occurredAt)} · {tx.account.name}
                  </span>
                </div>
                <span
                  className={`shrink-0 text-sm font-medium tabular-nums ${
                    tx.type === "EXPENSE" ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {tx.type === "EXPENSE" ? "-" : "+"}
                  {formatMoney(money(tx.amount, tx.currencyCode), meta)}
                </span>
              </div>

              <form action={confirmTransaction.bind(null, tx.id)} className="mt-2 flex flex-wrap gap-2">
                <select
                  name="categoryId"
                  defaultValue=""
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">Sin categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className={buttonVariants({ size: "sm" })}>
                  Confirmar
                </button>
              </form>
              <form action={ignoreTransaction.bind(null, tx.id)} className="mt-2">
                <button type="submit" className={buttonVariants({ size: "sm", variant: "ghost" })}>
                  Descartar
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
