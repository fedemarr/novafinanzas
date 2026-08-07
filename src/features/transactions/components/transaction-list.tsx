import type Decimal from "decimal.js";
import { formatMoney, money } from "@/lib/domain/money";
import { TRANSACTION_TYPE_LABELS } from "../schemas";

interface CurrencyMeta {
  symbol: string;
  decimals: number;
}

interface TransactionRow {
  id: string;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  // Prisma devuelve Prisma.Decimal (= decimal.js Decimal por debajo, ver
  // src/lib/domain/money.ts) — no un string.
  amount: Decimal.Value;
  currencyCode: string;
  occurredAt: Date;
  description: string | null;
  account: { name: string; currencyCode: string };
  counterAccount: { name: string } | null;
  category: { name: string } | null;
}

interface TransactionListProps {
  transactions: TransactionRow[];
  currencyMetaByCode: Map<string, CurrencyMeta>;
}

const dateFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" });

export function TransactionList({ transactions, currencyMetaByCode }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Todavía no cargaste ningún movimiento.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y">
      {transactions.map((tx) => {
        const meta = currencyMetaByCode.get(tx.currencyCode) ?? {
          symbol: tx.currencyCode,
          decimals: 2,
        };
        const sign = tx.type === "EXPENSE" ? "-" : tx.type === "INCOME" ? "+" : "";
        const label =
          tx.type === "TRANSFER"
            ? `${tx.account.name} → ${tx.counterAccount?.name ?? "?"}`
            : (tx.description ?? tx.category?.name ?? TRANSACTION_TYPE_LABELS[tx.type]);

        return (
          <li key={tx.id} className="flex items-center justify-between gap-4 py-3">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{label}</span>
              <span className="text-xs text-muted-foreground">
                {dateFormatter.format(tx.occurredAt)} · {tx.account.name}
                {tx.category ? ` · ${tx.category.name}` : ""}
              </span>
            </div>
            <span
              className={`shrink-0 text-sm font-medium tabular-nums ${
                tx.type === "EXPENSE"
                  ? "text-destructive"
                  : tx.type === "INCOME"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
              }`}
            >
              {sign}
              {formatMoney(money(tx.amount, tx.currencyCode), meta)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
