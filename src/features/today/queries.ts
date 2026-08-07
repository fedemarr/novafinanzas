import { prisma } from "@/lib/db/prisma";
import { findLatestRate } from "@/lib/db/exchange-rates";
import type { CommitmentKind } from "@/lib/domain/commitment";
import {
  computeAccountBalance,
  type BalanceAffectingTransaction,
} from "@/lib/domain/account-balance";
import { convertMoney, type RatePair } from "@/lib/domain/exchange-rate";
import { addMoney, money, type Money } from "@/lib/domain/money";
import {
  computeSafeToSpend,
  paydayInfo,
  prorateGoalContribution,
} from "@/lib/domain/safe-to-spend";

// ============================================================================
// "Hoy" (M3): responde "¿cuánto puedo gastar hoy?". Consolida todo a la
// moneda base del usuario con el rate vigente (invariantes #3 y #4): la
// conversión es solo para presentación, los montos guardados quedan intactos.
//
//   disponible          = Σ balances de cuentas isLiquid = true
//   ingresos previstos  = Σ RecurringIncomeOccurrence EXPECTED < próximo cobro
//   comprometido        = Σ CommitmentOccurrence SCHEDULED < próximo cobro
//   aporte objetivos    = Σ monthlyContribution de goals ACTIVE, prorrateado
//   safe-to-spend       = disponible + ingresos − comprometido − aporte,
//                         dividido por los días hasta el próximo cobro
// ============================================================================

export interface PaydaySummary {
  lastPayday: Date;
  nextPayday: Date;
  daysUntilPayday: number;
  cycleDays: number;
}

export interface SafeToSpendSummary {
  available: Money;
  incomeBeforePayday: Money;
  committedBeforePayday: Money;
  goalContributionForCycle: Money;
  total: Money;
  daily: Money;
  isDeficit: boolean;
}

export interface UpcomingOccurrence {
  id: string;
  dueDate: Date;
  amount: Money;
  commitmentName: string;
  commitmentKind: CommitmentKind;
  accountName: string;
}

export interface TodayView {
  baseCurrencyCode: string;
  payday: PaydaySummary;
  safeToSpend: SafeToSpendSummary;
  /** Monedas con datos que no se pudieron consolidar por falta de rate. */
  missingRateFor: string[];
  upcomingOccurrences: UpcomingOccurrence[];
}

export async function getTodayView(userId: string, now = new Date()): Promise<TodayView> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const payday = paydayInfo(user.payCycleDay, now);

  const [baseCurrency, accounts, transactions, commitmentOccurrences, incomeOccurrences, goals] =
    await Promise.all([
      prisma.currency.findUniqueOrThrow({
        where: { code: user.baseCurrencyCode },
        select: { decimals: true },
      }),
      prisma.account.findMany({
        where: { userId, deletedAt: null },
        select: {
          id: true,
          name: true,
          type: true,
          currencyCode: true,
          isLiquid: true,
          isActive: true,
          initialBalance: true,
        },
      }),
      prisma.transaction.findMany({
        where: { userId, deletedAt: null, status: "CONFIRMED" },
        include: { fxRate: true },
      }),
      prisma.commitmentOccurrence.findMany({
        where: {
          deletedAt: null,
          status: "SCHEDULED",
          dueDate: { lt: payday.nextPayday },
          commitment: { userId, deletedAt: null },
        },
        select: { amount: true, currencyCode: true },
      }),
      prisma.recurringIncomeOccurrence.findMany({
        where: {
          deletedAt: null,
          status: "EXPECTED",
          expectedDate: { lt: payday.nextPayday },
          recurringIncome: { userId, deletedAt: null },
        },
        select: { amount: true, currencyCode: true },
      }),
      prisma.goal.findMany({
        where: { userId, deletedAt: null, status: "ACTIVE" },
        select: { monthlyContribution: true, currencyCode: true },
      }),
    ]);

  const transactionsByAccount = new Map<string, BalanceAffectingTransaction[]>();
  for (const tx of transactions) {
    const entry: BalanceAffectingTransaction = {
      type: tx.type,
      amount: tx.amount,
      currency: tx.currencyCode,
      accountId: tx.accountId,
      counterAccountId: tx.counterAccountId,
      fxRate: tx.fxRate
        ? {
            baseCurrencyCode: tx.fxRate.baseCurrencyCode,
            quoteCurrencyCode: tx.fxRate.quoteCurrencyCode,
            rate: tx.fxRate.rate,
          }
        : null,
    };
    appendTx(transactionsByAccount, tx.accountId, entry);
    if (tx.counterAccountId) appendTx(transactionsByAccount, tx.counterAccountId, entry);
  }

  const rates = await loadRates(
    user.baseCurrencyCode,
    user.preferredRateType,
    accounts,
    commitmentOccurrences,
    incomeOccurrences,
    goals,
  );
  const missingRateFor = new Set<string>();

  let available = money("0", user.baseCurrencyCode);
  for (const account of accounts) {
    if (!account.isLiquid) continue;
    const balance = computeAccountBalance({
      accountId: account.id,
      accountCurrency: account.currencyCode,
      initialBalance: account.initialBalance,
      transactions: transactionsByAccount.get(account.id) ?? [],
    });
    const converted = convertIfPossible(balance, user.baseCurrencyCode, rates.get(account.currencyCode));
    if (converted) {
      available = addMoney(available, converted);
    } else {
      missingRateFor.add(account.currencyCode);
    }
  }

  const committedBeforePayday = sumConverted(
    commitmentOccurrences.map((occ) => money(occ.amount, occ.currencyCode)),
    user.baseCurrencyCode,
    rates,
    missingRateFor,
  );
  const incomeBeforePayday = sumConverted(
    incomeOccurrences.map((occ) => money(occ.amount, occ.currencyCode)),
    user.baseCurrencyCode,
    rates,
    missingRateFor,
  );

  let monthlyGoals = money("0", user.baseCurrencyCode);
  for (const goal of goals) {
    const converted = convertIfPossible(
      money(goal.monthlyContribution, goal.currencyCode),
      user.baseCurrencyCode,
      rates.get(goal.currencyCode),
    );
    if (converted) {
      monthlyGoals = addMoney(monthlyGoals, converted);
    } else {
      missingRateFor.add(goal.currencyCode);
    }
  }
  const goalContributionForCycle = prorateGoalContribution(
    monthlyGoals,
    payday.daysUntilPayday,
    payday.cycleDays,
    baseCurrency.decimals,
  );

  const result = computeSafeToSpend({
    available,
    incomeBeforePayday,
    committedBeforePayday,
    goalContributionForCycle,
    daysUntilPayday: payday.daysUntilPayday,
  });

  const nextOccurrences = await prisma.commitmentOccurrence.findMany({
    where: {
      deletedAt: null,
      status: "SCHEDULED",
      dueDate: { gte: now },
      commitment: { userId, deletedAt: null },
    },
    orderBy: { dueDate: "asc" },
    take: 8,
    include: {
      commitment: { select: { name: true, kind: true, account: { select: { name: true } } } },
    },
  });

  return {
    baseCurrencyCode: user.baseCurrencyCode,
    payday,
    safeToSpend: {
      available,
      incomeBeforePayday,
      committedBeforePayday,
      goalContributionForCycle,
      total: result.total,
      daily: result.daily,
      isDeficit: result.isDeficit,
    },
    missingRateFor: [...missingRateFor],
    upcomingOccurrences: nextOccurrences.map((occ) => ({
      id: occ.id,
      dueDate: occ.dueDate,
      amount: money(occ.amount, occ.currencyCode),
      commitmentName: occ.commitment.name,
      commitmentKind: occ.commitment.kind,
      accountName: occ.commitment.account.name,
    })),
  };
}

interface HasCurrencyCode {
  currencyCode: string;
}

async function loadRates(
  baseCurrencyCode: string,
  preferredRateType: Parameters<typeof findLatestRate>[2],
  ...groups: HasCurrencyCode[][]
): Promise<Map<string, RatePair>> {
  const foreignCodes = new Set<string>();
  for (const group of groups) {
    for (const item of group) {
      if (item.currencyCode !== baseCurrencyCode) foreignCodes.add(item.currencyCode);
    }
  }

  const rates = new Map<string, RatePair>();
  for (const code of foreignCodes) {
    const rate = await findLatestRate(code, baseCurrencyCode, preferredRateType);
    if (rate) rates.set(code, rate);
  }
  return rates;
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

function convertIfPossible(value: Money, target: string, rate: RatePair | undefined): Money | null {
  if (value.currency === target) return value;
  if (!rate) return null;
  return convertMoney(value, target, rate);
}

function sumConverted(
  items: Money[],
  base: string,
  rates: Map<string, RatePair>,
  missing: Set<string>,
): Money {
  let total = money("0", base);
  for (const item of items) {
    const converted = convertIfPossible(item, base, rates.get(item.currency));
    if (converted) {
      total = addMoney(total, converted);
    } else if (item.currency !== base) {
      missing.add(item.currency);
    }
  }
  return total;
}
