import { prisma } from "@/lib/db/prisma";

export async function listTransactionsFeed(userId: string) {
  return prisma.transaction.findMany({
    where: { userId, deletedAt: null },
    orderBy: { occurredAt: "desc" },
    take: 200,
    include: {
      account: { select: { id: true, name: true, currencyCode: true } },
      counterAccount: { select: { id: true, name: true } },
      category: { select: { id: true, name: true, icon: true, color: true } },
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
