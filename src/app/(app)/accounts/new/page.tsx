import { listCurrencies } from "@/features/accounts/queries";
import { AccountForm } from "@/features/accounts/components/account-form";

export default async function NewAccountPage() {
  const currencies = await listCurrencies();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <h1 className="text-lg font-semibold">Nueva cuenta</h1>
      <AccountForm currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))} />
    </div>
  );
}
