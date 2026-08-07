import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/require-user";
import { listCurrencies } from "@/features/accounts/queries";
import { getSavingsOverview } from "@/features/savings/queries";
import { TransferForm } from "@/features/savings/components/transfer-form";
import { SavingsOverviewView } from "@/features/savings/components/savings-overview";
import { ProjectionTable } from "@/features/savings/components/projection-table";

export default async function AhorroPage() {
  const userId = await requireUserId();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const [currencies, overview, fromAccounts, toAccounts] = await Promise.all([
    listCurrencies(),
    getSavingsOverview(userId, user.timezone),
    prisma.account.findMany({
      where: { userId, deletedAt: null, isActive: true, isSavings: false },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, currencyCode: true },
    }),
    prisma.account.findMany({
      where: { userId, deletedAt: null, isActive: true, isSavings: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, currencyCode: true },
    }),
  ]);

  const currencyMetaByCode = new Map(
    currencies.map((c) => [c.code, { symbol: c.symbol, decimals: c.decimals }]),
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <h1 className="text-lg font-semibold">Ahorro</h1>

      <div className="rounded-xl border bg-card p-4 ring-1 ring-foreground/5">
        <h2 className="mb-3 text-sm font-medium">Apartar plata</h2>
        <TransferForm fromAccounts={fromAccounts} toAccounts={toAccounts} />
      </div>

      <SavingsOverviewView overview={overview} currencyMetaByCode={currencyMetaByCode} />

      <div className="rounded-xl border bg-card p-4 ring-1 ring-foreground/5">
        <h2 className="mb-4 text-sm font-medium">Proyección</h2>
        <ProjectionTable
          monthlySaved={overview.monthlySaved}
          currencyMetaByCode={currencyMetaByCode}
          timeZone={user.timezone}
        />
      </div>
    </div>
  );
}
