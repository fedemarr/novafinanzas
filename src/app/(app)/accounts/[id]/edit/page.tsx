import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/require-user";
import { AccountForm } from "@/features/accounts/components/account-form";

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();

  const account = await prisma.account.findFirst({
    where: { id, userId, deletedAt: null },
  });

  if (!account) {
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <h1 className="text-lg font-semibold">Editar cuenta</h1>
      <AccountForm
        currencies={[]}
        account={{
          id: account.id,
          name: account.name,
          type: account.type,
          currencyCode: account.currencyCode,
          institutionKey: account.institutionKey,
          isLiquid: account.isLiquid,
          isSavings: account.isSavings,
          isActive: account.isActive,
          initialBalance: account.initialBalance.toString(),
        }}
      />
    </div>
  );
}
