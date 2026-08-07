import { requireUserId } from "@/lib/auth/require-user";
import { listCurrencies } from "@/features/accounts/queries";
import { listAccountsForSelect } from "@/features/transactions/queries";
import { CommitmentForm } from "@/features/commitments/components/commitment-form";

export default async function NewCommitmentPage() {
  const userId = await requireUserId();
  const [accounts, currencies] = await Promise.all([listAccountsForSelect(userId), listCurrencies()]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <h1 className="text-lg font-semibold">Nuevo compromiso</h1>
      <CommitmentForm
        accounts={accounts}
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
        defaultStartDate={today}
      />
    </div>
  );
}
