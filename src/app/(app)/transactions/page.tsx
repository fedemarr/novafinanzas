import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { requireUserId } from "@/lib/auth/require-user";
import { listTransactionsFeed } from "@/features/transactions/queries";
import { listCurrencies } from "@/features/accounts/queries";
import { TransactionList } from "@/features/transactions/components/transaction-list";

export default async function TransactionsPage() {
  const userId = await requireUserId();
  const [transactions, currencies] = await Promise.all([
    listTransactionsFeed(userId),
    listCurrencies(),
  ]);

  const currencyMetaByCode = new Map(
    currencies.map((c) => [c.code, { symbol: c.symbol, decimals: c.decimals }]),
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Movimientos</h1>
        <Link href="/transactions/new" className={buttonVariants({ size: "sm" })}>
          Nuevo movimiento
        </Link>
      </div>
      <TransactionList transactions={transactions} currencyMetaByCode={currencyMetaByCode} />
    </div>
  );
}
