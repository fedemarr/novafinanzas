import { prisma } from "@/lib/db/prisma";
import type Decimal from "decimal.js";

export async function listTransactionsFeed(userId: string) {
  return prisma.transaction.findMany({
    where: { userId, deletedAt: null, status: "CONFIRMED" },
    orderBy: { occurredAt: "desc" },
    take: 200,
    include: {
      account: { select: { id: true, name: true, currencyCode: true } },
      counterAccount: { select: { id: true, name: true } },
      category: { select: { id: true, name: true, icon: true, color: true } },
    },
  });
}

export interface PendingReviewTransaction {
  id: string;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  amount: Decimal;
  currencyCode: string;
  occurredAt: Date;
  description: string | null;
  merchantRaw: string | null;
  merchantNormalized: string | null;
  account: { id: string; name: string; currencyCode: string };
}

/** Triage (M4): transacciones que entraron por mail y esperan confirmación. */
export async function listPendingReview(userId: string): Promise<PendingReviewTransaction[]> {
  return prisma.transaction.findMany({
    where: { userId, deletedAt: null, status: "PENDING_REVIEW" },
    orderBy: { occurredAt: "asc" },
    include: {
      account: { select: { id: true, name: true, currencyCode: true } },
    },
  });
}

export async function listAccountsForSelect(userId: string) {
  return prisma.account.findMany({
    where: { userId, deletedAt: null, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, currencyCode: true },
  });
}

export async function listCategoriesForSelect() {
  return prisma.category.findMany({
    where: { isSystem: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
