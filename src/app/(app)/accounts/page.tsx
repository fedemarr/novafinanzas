import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { requireUserId } from "@/lib/auth/require-user";
import { listAccountsWithBalances, listCurrencies } from "@/features/accounts/queries";
import { AccountsOverviewView } from "@/features/accounts/components/accounts-overview";

export default async function AccountsPage() {
  const userId = await requireUserId();
  const [overview, currencies] = await Promise.all([
    listAccountsWithBalances(userId),
    listCurrencies(),
  ]);

  const currencyMetaByCode = new Map(
    currencies.map((c) => [c.code, { symbol: c.symbol, decimals: c.decimals }]),
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Cuentas</h1>
        <Link href="/accounts/new" className={buttonVariants({ size: "sm" })}>
          Nueva cuenta
        </Link>
      </div>
      <AccountsOverviewView overview={overview} currencyMetaByCode={currencyMetaByCode} />
    </div>
  );
}
