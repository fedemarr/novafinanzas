import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/require-user";
import {
  listAccountsForSelect,
  listCategoriesForSelect,
} from "@/features/transactions/queries";
import { listCurrencies } from "@/features/accounts/queries";
import { TransactionForm } from "@/features/transactions/components/transaction-form";

export default async function NewTransactionPage() {
  const userId = await requireUserId();
  const [accounts, categories, currencies, user] = await Promise.all([
    listAccountsForSelect(userId),
    listCategoriesForSelect(),
    listCurrencies(),
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <h1 className="text-lg font-semibold">Nuevo movimiento</h1>
      <TransactionForm
        accounts={accounts}
        categories={categories}
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
        defaultRateType={user.preferredRateType}
        defaultOccurredAt={today}
      />
    </div>
  );
}
