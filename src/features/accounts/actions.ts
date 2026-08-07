"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/require-user";
import { parseDecimalInput } from "@/lib/domain/money";
import { accountEditSchema, accountFormSchema } from "./schemas";

export type AccountFormState = { error: string | null };

export async function createAccount(
  _prevState: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const userId = await requireUserId();

  const parsed = accountFormSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    currencyCode: formData.get("currencyCode"),
    institutionKey: formData.get("institutionKey"),
    isLiquid: formData.get("isLiquid") === "on",
    initialBalance: formData.get("initialBalance"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  let initialBalance;
  try {
    initialBalance = parseDecimalInput(parsed.data.initialBalance);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Monto inválido." };
  }

  const currency = await prisma.currency.findUnique({
    where: { code: parsed.data.currencyCode },
  });
  if (!currency) {
    return { error: "Esa moneda no existe." };
  }

  await prisma.account.create({
    data: {
      userId,
      name: parsed.data.name,
      type: parsed.data.type,
      currencyCode: parsed.data.currencyCode,
      institutionKey: parsed.data.institutionKey ?? null,
      isLiquid: parsed.data.isLiquid,
      initialBalance: initialBalance.toString(),
      isActive: true,
    },
  });

  revalidatePath("/accounts");
  redirect("/accounts");
}

export async function updateAccount(
  accountId: string,
  _prevState: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const userId = await requireUserId();

  const existing = await prisma.account.findFirst({
    where: { id: accountId, userId, deletedAt: null },
  });
  if (!existing) {
    return { error: "Cuenta no encontrada." };
  }

  const parsed = accountEditSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    institutionKey: formData.get("institutionKey"),
    isLiquid: formData.get("isLiquid") === "on",
    isActive: formData.get("isActive") === "on",
    initialBalance: formData.get("initialBalance"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  let initialBalance;
  try {
    initialBalance = parseDecimalInput(parsed.data.initialBalance);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Monto inválido." };
  }

  await prisma.account.update({
    where: { id: accountId },
    data: {
      name: parsed.data.name,
      type: parsed.data.type,
      institutionKey: parsed.data.institutionKey ?? null,
      isLiquid: parsed.data.isLiquid,
      isActive: parsed.data.isActive,
      initialBalance: initialBalance.toString(),
    },
  });

  revalidatePath("/accounts");
  redirect("/accounts");
}
