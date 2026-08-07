"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/require-user";
import { parseAmountInput } from "@/lib/domain/money";
import { computeDedupeHash } from "@/lib/domain/dedupe-hash";
import { Prisma } from "@/generated/prisma/client";

// ============================================================================
// Carga rápida (v2): anotar un gasto/ingreso del día sin salir de la
// planilla. La moneda es SIEMPRE la de la cuenta elegida — así no hay
// conversión ni rate que cargar (eso es lo que mataba la simpleza).
// ============================================================================

export type QuickEntryState = { error: string | null; success: boolean };

const quickEntrySchema = z.object({
  type: z.enum(["EXPENSE", "INCOME"]),
  accountId: z.string().min(1, "Elegí una cuenta."),
  amount: z.string().min(1, "Ingresá un monto."),
  categoryId: z.string().optional().or(z.literal("")),
  occurredAt: z.string().optional().or(z.literal("")),
  description: z.string().max(200).optional().or(z.literal("")),
});

export async function createQuickEntry(
  _prevState: QuickEntryState,
  formData: FormData,
): Promise<QuickEntryState> {
  const userId = await requireUserId();

  const parsed = quickEntrySchema.safeParse({
    type: formData.get("type"),
    accountId: formData.get("accountId"),
    amount: formData.get("amount"),
    categoryId: formData.get("categoryId"),
    occurredAt: formData.get("occurredAt"),
    description: formData.get("description"),
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

  const account = await prisma.account.findFirst({
    where: { id: data.accountId, userId, deletedAt: null, isActive: true },
  });
  if (!account) {
    return { error: "Cuenta no encontrada.", success: false };
  }

  // [INVARIANTE] la moneda de la transacción es la de la cuenta. Nunca
  // guardamos un monto convertido (invariante #3) y acá ni siquiera hay
  // conversión: el usuario anota en la moneda en la que paga.
  const occurredAt = data.occurredAt
    ? new Date(`${data.occurredAt}T12:00:00.000Z`)
    : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    return { error: "Fecha inválida.", success: false };
  }

  let categoryId: string | null = null;
  if (data.categoryId) {
    const category = await prisma.category.findFirst({
      where: {
        id: data.categoryId,
        deletedAt: null,
        OR: [{ isSystem: true }, { userId }],
      },
    });
    if (!category) {
      return { error: "Categoría inválida.", success: false };
    }
    categoryId = category.id;
  }

  const dedupeHash = computeDedupeHash({
    userId,
    accountId: account.id,
    amount: amount.toString(),
    currency: account.currencyCode,
    occurredAt,
    merchantKey: data.description || null,
  });

  try {
    await prisma.transaction.create({
      data: {
        userId,
        accountId: account.id,
        type: data.type,
        amount: amount.toString(),
        currencyCode: account.currencyCode,
        occurredAt,
        description: data.description || null,
        categoryId,
        status: "CONFIRMED",
        source: "MANUAL",
        dedupeHash,
      },
    });
  } catch (err) {
    if (isDedupeCollision(err)) {
      return {
        error: "Ya cargaste un movimiento igual para esta cuenta y este día.",
        success: false,
      };
    }
    throw err;
  }

  revalidatePath("/planilla");
  return { error: null, success: true };
}

// ============================================================================
// Edición/borrado (v2): desde la grilla se abre el día y cada movimiento se
// puede editar (monto, categoría, detalle, fecha) o borrar (soft delete).
// La moneda y la cuenta quedan fijas — editarlas rompería el balance.
// ============================================================================

export type EditEntryState = { error: string | null; success: boolean };

const editEntrySchema = z.object({
  amount: z.string().min(1, "Ingresá un monto."),
  categoryId: z.string().optional().or(z.literal("")),
  occurredAt: z.string().min(1, "Elegí la fecha."),
  description: z.string().max(200).optional().or(z.literal("")),
});

export async function updatePlanillaEntry(
  entryId: string,
  _prevState: EditEntryState,
  formData: FormData,
): Promise<EditEntryState> {
  const userId = await requireUserId();

  const existing = await prisma.transaction.findFirst({
    where: {
      id: entryId,
      userId,
      deletedAt: null,
      type: { in: ["EXPENSE", "INCOME"] },
    },
  });
  if (!existing) {
    return { error: "Movimiento no encontrado.", success: false };
  }

  const parsed = editEntrySchema.safeParse({
    amount: formData.get("amount"),
    categoryId: formData.get("categoryId"),
    occurredAt: formData.get("occurredAt"),
    description: formData.get("description"),
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

  const occurredAt = new Date(`${data.occurredAt}T12:00:00.000Z`);
  if (Number.isNaN(occurredAt.getTime())) {
    return { error: "Fecha inválida.", success: false };
  }

  let categoryId: string | null = null;
  if (data.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, deletedAt: null, OR: [{ isSystem: true }, { userId }] },
    });
    if (!category) {
      return { error: "Categoría inválida.", success: false };
    }
    categoryId = category.id;
  }

  const dedupeHash = computeDedupeHash({
    userId,
    accountId: existing.accountId,
    amount: amount.toString(),
    currency: existing.currencyCode,
    occurredAt,
    merchantKey: data.description || null,
  });

  try {
    await prisma.transaction.update({
      where: { id: entryId },
      data: {
        amount: amount.toString(),
        categoryId,
        description: data.description || null,
        occurredAt,
        dedupeHash,
      },
    });
  } catch (err) {
    if (isDedupeCollision(err)) {
      return {
        error: "Ya cargaste un movimiento igual para esta cuenta y este día.",
        success: false,
      };
    }
    throw err;
  }

  revalidatePath("/planilla");
  revalidatePath("/ahorro");
  revalidatePath("/accounts");
  return { error: null, success: true };
}

export async function deletePlanillaEntry(entryId: string): Promise<void> {
  const userId = await requireUserId();

  await prisma.transaction.updateMany({
    where: {
      id: entryId,
      userId,
      deletedAt: null,
      type: { in: ["EXPENSE", "INCOME"] },
    },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/planilla");
  revalidatePath("/ahorro");
  revalidatePath("/accounts");
}

function isDedupeCollision(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (err.code !== "P2002") return false;
  const target = err.meta?.target;
  const targets = Array.isArray(target) ? target.map(String) : [String(target)];
  return targets.some((t) => t.toLowerCase().includes("dedupe"));
}
