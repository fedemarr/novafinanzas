import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/require-user";
import { listCurrencies } from "@/features/accounts/queries";
import { listAccountsForSelect } from "@/features/transactions/queries";
import { CommitmentForm, type ExistingCommitment } from "@/features/commitments/components/commitment-form";
import { deleteCommitment } from "@/features/commitments/actions";

export default async function EditCommitmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();

  const commitment = await prisma.commitment.findFirst({
    where: { id, userId, deletedAt: null },
  });

  if (!commitment) {
    notFound();
  }

  const firstOccurrence = await prisma.commitmentOccurrence.findFirst({
    where: { commitmentId: commitment.id, deletedAt: null },
    orderBy: { dueDate: "asc" },
    select: { installmentNumber: true, installmentTotal: true },
  });

  const [accounts, currencies] = await Promise.all([listAccountsForSelect(userId), listCurrencies()]);

  const existing: ExistingCommitment = {
    id: commitment.id,
    name: commitment.name,
    kind: commitment.kind,
    accountId: commitment.accountId,
    currencyCode: commitment.currencyCode,
    totalAmount: commitment.totalAmount.toString(),
    installmentTotal: firstOccurrence?.installmentTotal?.toString() ?? "",
    startDate: commitment.startDate.toISOString().slice(0, 10),
    endDate: commitment.endDate ? commitment.endDate.toISOString().slice(0, 10) : "",
    isActive: commitment.isActive,
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <h1 className="text-lg font-semibold">Editar compromiso</h1>
      <CommitmentForm
        accounts={accounts}
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
        defaultStartDate={existing.startDate}
        existing={existing}
      />
      <form
        action={async () => {
          "use server";
          await deleteCommitment(id);
        }}
      >
        <button
          type="submit"
          className="text-sm text-destructive underline underline-offset-4"
        >
          Eliminar compromiso
        </button>
      </form>
    </div>
  );
}
