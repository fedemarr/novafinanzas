"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/require-user";
import { parseAmountInput, parseDecimalInput } from "@/lib/domain/money";
import { computeDedupeHash } from "@/lib/domain/dedupe-hash";
import { Prisma } from "@/generated/prisma/client";
import { transactionFormSchema } from "./schemas";

export type TransactionFormState = { error: string | null };

export async function createTransaction(
  _prevState: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const userId = await requireUserId();

  const parsed = transactionFormSchema.safeParse({
    type: formData.get("type"),
    accountId: formData.get("accountId"),
    counterAccountId: formData.get("counterAccountId"),
    amount: formData.get("amount"),
    currencyCode: formData.get("currencyCode"),
    occurredAt: formData.get("occurredAt"),
    categoryId: formData.get("categoryId"),
    description: formData.get("description"),
    notes: formData.get("notes"),
    fxRateValue: formData.get("fxRateValue"),
    fxRateType: formData.get("fxRateType") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  let amount;
  try {
    amount = parseAmountInput(data.amount);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Monto inválido." };
  }

  const occurredAt = new Date(data.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) {
    return { error: "Fecha inválida." };
  }

  const account = await prisma.account.findFirst({
    where: { id: data.accountId, userId, deletedAt: null },
  });
  if (!account) {
    return { error: "Cuenta no encontrada." };
  }

  let counterAccountId: string | null = null;
  if (data.type === "TRANSFER") {
    const counterAccount = await prisma.account.findFirst({
      where: { id: data.counterAccountId, userId, deletedAt: null },
    });
    if (!counterAccount) {
      return { error: "Cuenta destino no encontrada." };
    }
    if (counterAccount.currencyCode !== account.currencyCode) {
      // [FUERA DE ALCANCE M1] ver plan del milestone: una transferencia
      // cross-currency real necesita dos montos (uno por lado) y el
      // schema no lo contempla — no lo inventamos en silencio acá.
      return {
        error:
          "Transferencias entre cuentas de distinta moneda no están soportadas todavía (M1).",
      };
    }
    counterAccountId = counterAccount.id;
  }

  // La transacción puede estar denominada en una moneda distinta a la de
  // la cuenta (ej. gasto en USD desde una cuenta en ARS). Si difieren,
  // necesitamos el rate que usó ese movimiento — invariante #4.
  let fxRateId: string | null = null;
  if (data.currencyCode !== account.currencyCode) {
    if (data.type === "TRANSFER") {
      return { error: "La moneda de la transferencia tiene que ser la de la cuenta de origen." };
    }
    if (!data.fxRateValue || !data.fxRateType) {
      return {
        error: `Elegiste ${data.currencyCode} en una cuenta en ${account.currencyCode} — ingresá el rate usado.`,
      };
    }

    let rateValue;
    try {
      rateValue = parseDecimalInput(data.fxRateValue);
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Rate inválido." };
    }
    if (rateValue.isNegative() || rateValue.isZero()) {
      return { error: "El rate tiene que ser mayor a cero." };
    }

    const currency = await prisma.currency.findUnique({ where: { code: data.currencyCode } });
    if (!currency) {
      return { error: "Esa moneda no existe." };
    }

    const createdRate = await prisma.exchangeRate.create({
      data: {
        baseCurrencyCode: data.currencyCode,
        quoteCurrencyCode: account.currencyCode,
        rateType: data.fxRateType,
        rate: rateValue.toString(),
        validAt: occurredAt,
        source: "manual",
      },
    });
    fxRateId = createdRate.id;
  }

  const merchantKey = data.description ?? null;
  const dedupeHash = computeDedupeHash({
    userId,
    accountId: account.id,
    amount: amount.toString(),
    currency: data.currencyCode,
    occurredAt,
    merchantKey,
  });

  try {
    await prisma.transaction.create({
      data: {
        userId,
        accountId: account.id,
        type: data.type,
        amount: amount.toString(),
        currencyCode: data.currencyCode,
        fxRateId,
        occurredAt,
        description: data.description ?? null,
        categoryId: data.type === "TRANSFER" ? null : (data.categoryId ?? null),
        status: "CONFIRMED",
        source: "MANUAL",
        dedupeHash,
        counterAccountId,
        notes: data.notes ?? null,
      },
    });
  } catch (err) {
    if (isDedupeCollision(err)) {
      return { error: "Ya cargaste un movimiento igual para esta cuenta y este día." };
    }
    throw err;
  }

  revalidatePath("/accounts");
  revalidatePath("/transactions");
  redirect("/transactions");
}

function isDedupeCollision(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (err.code !== "P2002") return false;
  const target = err.meta?.target;
  const targets = Array.isArray(target) ? target.map(String) : [String(target)];
  return targets.some((t) => t.toLowerCase().includes("dedupe"));
}

// ============================================================================
// Triage (M4): las transacciones que entran por mail (source=EMAIL) se crean
// PENDING_REVIEW y esperan confirmación en la pantalla Movimientos. Confirmar
// → CONFIRMED (+ categoría opcional); descartar → IGNORED (desaparece del
// feed). El matching contra compromisos (linkear a CommitmentOccurrence) es M5.
// ============================================================================

export async function confirmTransaction(
  transactionId: string,
  formData: FormData,
): Promise<void> {
  const userId = await requireUserId();

  const existing = await prisma.transaction.findFirst({
    where: { id: transactionId, userId, deletedAt: null, status: "PENDING_REVIEW" },
  });
  if (!existing) return;

  const rawCategory = formData.get("categoryId");
  let categoryId: string | null = null;
  if (typeof rawCategory === "string" && rawCategory) {
    const category = await prisma.category.findFirst({
      where: {
        id: rawCategory,
        deletedAt: null,
        OR: [{ isSystem: true }, { userId }],
      },
    });
    if (!category) return;
    categoryId = category.id;
  }

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { status: "CONFIRMED", categoryId },
  });

  revalidatePath("/transactions");
}

export async function ignoreTransaction(transactionId: string): Promise<void> {
  const userId = await requireUserId();

  await prisma.transaction.updateMany({
    where: { id: transactionId, userId, deletedAt: null, status: "PENDING_REVIEW" },
    data: { status: "IGNORED" },
  });

  revalidatePath("/transactions");
}
