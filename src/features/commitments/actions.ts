"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/require-user";
import { parseDecimalInput } from "@/lib/domain/money";
import {
  buildMonthlyRecurrenceRule,
  buildOccurrenceDrafts,
  commitmentHorizonEnd,
  isFiniteKind,
  isRecurringKind,
} from "@/lib/domain/commitment";
import { commitmentFormSchema, type CommitmentFormData } from "./schemas";

export type CommitmentFormState = { error: string | null };

function parseDate(raw: string, field: string): Date {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} inválida.`);
  }
  return date;
}

type LoadResult =
  | {
      ok: true;
      account: {
        id: string;
        currencyCode: string;
      };
      currency: { decimals: number };
    }
  | { ok: false; error: string };

function buildSpecFromParsed(data: CommitmentFormData, decimals: number) {
  if (isFiniteKind(data.kind)) {
    return {
      kind: data.kind,
      totalAmount: data.totalAmount,
      currency: data.currencyCode,
      decimals,
      startDate: parseDate(data.startDate, "Fecha de inicio"),
      endDate: null,
      installmentTotal: Number(data.installmentTotal),
      recurrenceRule: null,
    };
  }
  if (isRecurringKind(data.kind)) {
    const startDate = parseDate(data.startDate, "Fecha de inicio");
    const endDate = data.endDate ? parseDate(data.endDate, "Fecha de fin") : null;
    return {
      kind: data.kind,
      totalAmount: data.totalAmount,
      currency: data.currencyCode,
      decimals,
      startDate,
      endDate,
      installmentTotal: null,
      recurrenceRule: buildMonthlyRecurrenceRule(startDate),
    };
  }
  throw new Error("Tipo de compromiso inválido.");
}

async function loadDependencies(
  userId: string,
  accountId: string,
  currencyCode: string,
): Promise<LoadResult> {
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId, deletedAt: null },
    select: { id: true, currencyCode: true },
  });
  if (!account) return { ok: false, error: "Cuenta no encontrada." };

  const currency = await prisma.currency.findUnique({
    where: { code: currencyCode },
    select: { decimals: true },
  });
  if (!currency) return { ok: false, error: "Esa moneda no existe." };

  return { ok: true, account, currency };
}

export async function createCommitment(
  _prevState: CommitmentFormState,
  formData: FormData,
): Promise<CommitmentFormState> {
  const userId = await requireUserId();

  const parsed = commitmentFormSchema.safeParse({
    kind: formData.get("kind"),
    name: formData.get("name"),
    accountId: formData.get("accountId"),
    currencyCode: formData.get("currencyCode"),
    totalAmount: formData.get("totalAmount"),
    installmentTotal: formData.get("installmentTotal") || undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || undefined,
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  const deps = await loadDependencies(userId, data.accountId, data.currencyCode);
  if (!deps.ok) return { error: deps.error };

  let totalAmount;
  try {
    totalAmount = parseDecimalInput(data.totalAmount);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Monto inválido." };
  }

  let spec;
  try {
    spec = buildSpecFromParsed(data, deps.currency.decimals);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Datos inválidos." };
  }

  const horizonEnd = commitmentHorizonEnd();
  let drafts;
  try {
    drafts = buildOccurrenceDrafts(spec, horizonEnd);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Compromiso inválido." };
  }

  await prisma.$transaction(async (tx) => {
    const commitment = await tx.commitment.create({
      data: {
        userId,
        name: data.name,
        kind: spec.kind,
        accountId: deps.account.id,
        currencyCode: spec.currency,
        totalAmount: totalAmount.toString(),
        startDate: spec.startDate,
        endDate: spec.endDate,
        recurrenceRule: spec.recurrenceRule,
        isActive: data.isActive,
      },
    });

    await tx.commitmentOccurrence.createMany({
      data: drafts.map((d) => ({
        commitmentId: commitment.id,
        dueDate: d.dueDate,
        amount: d.amount.amount.toString(),
        currencyCode: d.amount.currency,
        status: "SCHEDULED",
        installmentNumber: d.installmentNumber,
        installmentTotal: d.installmentTotal,
      })),
    });
  });

  revalidatePath("/commitments");
  redirect("/commitments");
}

export async function updateCommitment(
  commitmentId: string,
  _prevState: CommitmentFormState,
  formData: FormData,
): Promise<CommitmentFormState> {
  const userId = await requireUserId();

  const existing = await prisma.commitment.findFirst({
    where: { id: commitmentId, userId, deletedAt: null },
  });
  if (!existing) {
    return { error: "Compromiso no encontrado." };
  }

  const parsed = commitmentFormSchema.safeParse({
    kind: formData.get("kind"),
    name: formData.get("name"),
    accountId: formData.get("accountId"),
    currencyCode: formData.get("currencyCode"),
    totalAmount: formData.get("totalAmount"),
    installmentTotal: formData.get("installmentTotal") || undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || undefined,
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  const deps = await loadDependencies(userId, data.accountId, data.currencyCode);
  if (!deps.ok) return { error: deps.error };

  let totalAmount;
  try {
    totalAmount = parseDecimalInput(data.totalAmount);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Monto inválido." };
  }

  let spec;
  try {
    spec = buildSpecFromParsed(data, deps.currency.decimals);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Datos inválidos." };
  }

  let drafts;
  try {
    drafts = buildOccurrenceDrafts(spec, commitmentHorizonEnd());
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Compromiso inválido." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.commitment.update({
      where: { id: commitmentId },
      data: {
        name: data.name,
        kind: spec.kind,
        accountId: deps.account.id,
        currencyCode: spec.currency,
        totalAmount: totalAmount.toString(),
        startDate: spec.startDate,
        endDate: spec.endDate,
        recurrenceRule: spec.recurrenceRule,
        isActive: data.isActive,
      },
    });

    // Las ocurrencias son datos derivados: se regeneran enteras. En M2
    // ninguna está linkeada a una transacción real todavía (eso llega en
    // M4/M5 con el matching); cuando existan links, esto va a tener que
    // preservar las ocurrencias con transactionId y solo recrear el resto.
    await tx.commitmentOccurrence.deleteMany({ where: { commitmentId } });

    await tx.commitmentOccurrence.createMany({
      data: drafts.map((d) => ({
        commitmentId,
        dueDate: d.dueDate,
        amount: d.amount.amount.toString(),
        currencyCode: d.amount.currency,
        status: "SCHEDULED",
        installmentNumber: d.installmentNumber,
        installmentTotal: d.installmentTotal,
      })),
    });
  });

  revalidatePath("/commitments");
  redirect("/commitments");
}

export async function deleteCommitment(commitmentId: string): Promise<void> {
  const userId = await requireUserId();

  const existing = await prisma.commitment.findFirst({
    where: { id: commitmentId, userId, deletedAt: null },
  });
  if (!existing) {
    return;
  }

  // Soft delete — invariante #7. El compromiso y sus ocurrencias dejan de
  // existir para toda query de producción.
  const now = new Date();
  await prisma.$transaction([
    prisma.commitmentOccurrence.updateMany({
      where: { commitmentId, deletedAt: null },
      data: { deletedAt: now },
    }),
    prisma.commitment.update({
      where: { id: commitmentId },
      data: { deletedAt: now },
    }),
  ]);

  revalidatePath("/commitments");
}
