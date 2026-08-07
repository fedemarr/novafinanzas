import { prisma } from "@/lib/db/prisma";
import Decimal from "decimal.js";
import {
  computeAccountBalance,
  type BalanceAffectingTransaction,
} from "@/lib/domain/account-balance";
import { money, type Money } from "@/lib/domain/money";
import { localDateString } from "@/features/planilla/queries";

// ============================================================================
// Ahorro (v2): la plata que el usuario "aparta". Un apartado es una
// transferencia desde una cuenta normal hacia una cuenta con isSavings=true.
// Totales siempre por moneda, en su moneda nativa (invariante #3): ARS y USD
// se muestran por separado, nunca se mezclan en un total inventado.
// ============================================================================

export interface SavingsAccountView {
  id: string;
  name: string;
  currencyCode: string;
  balance: Money;
}

export interface RecentTransfer {
  id: string;
  amount: Money;
  fromName: string;
  toName: string;
  occurredAt: Date;
}

export interface SavingsOverview {
  accounts: SavingsAccountView[];
  totalsByCurrency: Money[];
  /** Aportes por moneda de los últimos 3 meses cerrados, más viejo a más nuevo. */
  monthlySaved: Record<string, Money[]>;
  recentTransfers: RecentTransfer[];
}

const COMPLETED_MONTHS = 3;

export async function getSavingsOverview(
  userId: string,
  timeZone: string,
): Promise<SavingsOverview> {
  const savingsAccounts = await prisma.account.findMany({
    where: { userId, deletedAt: null, isSavings: true },
    orderBy: { createdAt: "asc" },
  });
  const savingsIds = savingsAccounts.map((a) => a.id);

  const [transactions, recentTransfers] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, deletedAt: null, status: "CONFIRMED" },
      include: { fxRate: true },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        status: "CONFIRMED",
        type: "TRANSFER",
        counterAccountId: { in: savingsIds },
      },
      orderBy: { occurredAt: "desc" },
      take: 8,
      include: {
        account: { select: { name: true } },
        counterAccount: { select: { name: true } },
      },
    }),
  ]);

  const byAccount = new Map<string, BalanceAffectingTransaction[]>();
  for (const tx of transactions) {
    const entry: BalanceAffectingTransaction = {
      type: tx.type,
      amount: tx.amount,
      currency: tx.currencyCode,
      accountId: tx.accountId,
      counterAccountId: tx.counterAccountId,
      fxRate: tx.fxRate
        ? { baseCurrencyCode: tx.fxRate.baseCurrencyCode, quoteCurrencyCode: tx.fxRate.quoteCurrencyCode, rate: tx.fxRate.rate }
        : null,
    };
    appendTx(byAccount, tx.accountId, entry);
    if (tx.counterAccountId) appendTx(byAccount, tx.counterAccountId, entry);
  }

  const accounts: SavingsAccountView[] = savingsAccounts.map((account) => ({
    id: account.id,
    name: account.name,
    currencyCode: account.currencyCode,
    balance: computeAccountBalance({
      accountId: account.id,
      accountCurrency: account.currencyCode,
      initialBalance: account.initialBalance,
      transactions: byAccount.get(account.id) ?? [],
    }),
  }));

  const totals = new Map<string, Decimal>();
  for (const account of accounts) {
    totals.set(account.currencyCode, (totals.get(account.currencyCode) ?? account.balance.amount).plus(account.balance.amount));
  }
  const totalsByCurrency = [...totals.entries()].map(([currency, amount]) =>
    money(amount, currency),
  );

  return {
    accounts,
    totalsByCurrency,
    monthlySaved: await computeMonthlySaved(userId, savingsIds, timeZone),
    recentTransfers: recentTransfers.map((tx) => ({
      id: tx.id,
      amount: money(tx.amount, tx.currencyCode),
      fromName: tx.account.name,
      toName: tx.counterAccount?.name ?? "Ahorro",
      occurredAt: tx.occurredAt,
    })),
  };
}

/**
 * Aportes de los últimos `COMPLETED_MONTHS` meses cerrados (los anteriores
 * al mes actual en la zona del usuario), por moneda. Incluye meses con cero
 * apartado: el promedio de la proyección tiene que reflejar que un mes no
 * se ahorró. De más viejo a más nuevo.
 */
async function computeMonthlySaved(
  userId: string,
  savingsIds: string[],
  timeZone: string,
): Promise<Record<string, Money[]>> {
  const nowPrefix = localDateString(new Date(), timeZone).slice(0, 7);
  const prefixes: string[] = [];
  const boundaries: Date[] = [];

  for (let back = COMPLETED_MONTHS; back >= 1; back--) {
    const date = shiftMonth(new Date(`${nowPrefix}-01T00:00:00.000Z`), -back);
    prefixes.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  const windowStart = shiftMonth(new Date(`${nowPrefix}-01T00:00:00.000Z`), -COMPLETED_MONTHS);
  const windowEnd = shiftMonth(new Date(`${nowPrefix}-01T00:00:00.000Z`), 0);
  boundaries.push(windowStart, windowEnd);

  const margin = 2 * 24 * 60 * 60 * 1000;
  const transfers = await prisma.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      status: "CONFIRMED",
      type: "TRANSFER",
      counterAccountId: { in: savingsIds },
      occurredAt: { gte: new Date(windowStart.getTime() - margin), lt: new Date(windowEnd.getTime() + margin) },
    },
    select: { amount: true, currencyCode: true, occurredAt: true },
  });

  const byCurrency = new Map<string, Map<string, Decimal>>();
  for (const tx of transfers) {
    const prefix = localDateString(tx.occurredAt, timeZone).slice(0, 7);
    if (!prefixes.includes(prefix)) continue;
    let months = byCurrency.get(tx.currencyCode);
    if (!months) {
      months = new Map();
      byCurrency.set(tx.currencyCode, months);
    }
    months.set(prefix, (months.get(prefix) ?? new Decimal(0)).plus(tx.amount));
  }

  const result: Record<string, Money[]> = {};
  for (const [currency, months] of byCurrency) {
    result[currency] = prefixes.map((prefix) =>
      money(months.get(prefix) ?? "0", currency),
    );
  }
  return result;
}

function shiftMonth(date: Date, offset: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
}

function appendTx(
  map: Map<string, BalanceAffectingTransaction[]>,
  accountId: string,
  entry: BalanceAffectingTransaction,
) {
  const list = map.get(accountId);
  if (list) {
    list.push(entry);
  } else {
    map.set(accountId, [entry]);
  }
}
