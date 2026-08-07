"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/require-user";
import { parseAmountInput } from "@/lib/domain/money";
import { computeDedupeHash } from "@/lib/domain/dedupe-hash";
import { Prisma } from "@/generated/prisma/client";

// ============================================================================
// "Apartar" (v2): mover plata desde una cuenta normal hacia una cuenta de
// ahorro. Queda registrado como TRANSFERENCIA (la plata no se pierde, solo
// cambia de lugar) y alimenta el balance de la cuenta de ahorro.
// ============================================================================

export type TransferState = { error: string | null; success: boolean };

const transferSchema = z.object({
  fromAccountId: z.string().min(1, "Elegí la cuenta de origen."),
  toAccountId: z.string().min(1, "Elegí la cuenta de ahorro."),
  amount: z.string().min(1, "Ingresá un monto."),
  occurredAt: z.string().optional().or(z.literal("")),
});

export async function transferToSavings(
  _prevState: TransferState,
  formData: FormData,
): Promise<TransferState> {
  const userId = await requireUserId();

  const parsed = transferSchema.safeParse({
    fromAccountId: formData.get("fromAccountId"),
    toAccountId: formData.get("toAccountId"),
    amount: formData.get("amount"),
    occurredAt: formData.get("occurredAt"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos.", success: false };
  }
  const data = parsed.data;

  let amount;
  try {
    amount = parseAmountInput(data.amount);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Monto inválido.", success: false };
  }

  const fromAccount = await prisma.account.findFirst({
    where: { id: data.fromAccountId, userId, deletedAt: null, isActive: true, isSavings: false },
  });
  const toAccount = await prisma.account.findFirst({
    where: { id: data.toAccountId, userId, deletedAt: null, isActive: true, isSavings: true },
  });
  if (!fromAccount || !toAccount) {
    return { error: "Cuenta no encontrada.", success: false };
  }
  if (fromAccount.id === toAccount.id) {
    return { error: "El origen y el ahorro tienen que ser cuentas distintas.", success: false };
  }
  if (fromAccount.currencyCode !== toAccount.currencyCode) {
    return {
      error: "El apartado tiene que ser en la misma moneda que la cuenta de origen.",
      success: false,
    };
  }

  const occurredAt = data.occurredAt
    ? new Date(`${data.occurredAt}T12:00:00.000Z`)
    : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    return { error: "Fecha inválida.", success: false };
  }

  const dedupeHash = computeDedupeHash({
    userId,
    accountId: fromAccount.id,
    amount: amount.toString(),
    currency: fromAccount.currencyCode,
    occurredAt,
    merchantKey: null,
  });

  try {
    await prisma.transaction.create({
      data: {
        userId,
        accountId: fromAccount.id,
        type: "TRANSFER",
        amount: amount.toString(),
        currencyCode: fromAccount.currencyCode,
        occurredAt,
        status: "CONFIRMED",
        source: "MANUAL",
        dedupeHash,
        counterAccountId: toAccount.id,
      },
    });
  } catch (err) {
    if (isDedupeCollision(err)) {
      return { error: "Ya cargaste un apartado igual para esta cuenta y este día.", success: false };
    }
    throw err;
  }

  revalidatePath("/ahorro");
  revalidatePath("/planilla");
  return { error: null, success: true };
}

function isDedupeCollision(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (err.code !== "P2002") return false;
  const target = err.meta?.target;
  const targets = Array.isArray(target) ? target.map(String) : [String(target)];
  return targets.some((t) => t.toLowerCase().includes("dedupe"));
}
