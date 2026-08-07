import { prisma } from "@/lib/db/prisma";
import { findLatestRate } from "@/lib/db/exchange-rates";
import {
  computeAccountBalance,
  type BalanceAffectingTransaction,
} from "@/lib/domain/account-balance";
import { convertMoney, type RatePair } from "@/lib/domain/exchange-rate";
import { addMoney, money, type Money } from "@/lib/domain/money";

export async function listCurrencies() {
  return prisma.currency.findMany({ where: { deletedAt: null }, orderBy: { code: "asc" } });
}

export interface AccountWithBalance {
  id: string;
  name: string;
  type: string;
  currencyCode: string;
  isLiquid: boolean;
  isSavings: boolean;
  isActive: boolean;
  institutionKey: string | null;
  balance: Money;
  /** null = no hay rate disponible para consolidar esta cuenta todavía. */
  balanceInBaseCurrency: Money | null;
}

export interface AccountsOverview {
  baseCurrencyCode: string;
  accounts: AccountWithBalance[];
  total: Money;
  /** Monedas de cuentas que no se pudieron sumar al total por falta de rate. */
  missingRateFor: string[];
}

export async function listAccountsWithBalances(userId: string): Promise<AccountsOverview> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const accounts = await prisma.account.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  const transactions = await prisma.transaction.findMany({
    where: { userId, deletedAt: null, status: "CONFIRMED" },
    include: { fxRate: true },
  });

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

  const foreignCurrencyCodes = [...new Set(accounts.map((a) => a.currencyCode))].filter(
    (code) => code !== user.baseCurrencyCode,
  );
  const ratesByCurrency = new Map<string, RatePair>();
  for (const code of foreignCurrencyCodes) {
    const rate = await findLatestRate(code, user.baseCurrencyCode, user.preferredRateType);
    if (rate) ratesByCurrency.set(code, rate);
  }

  const accountsWithBalance: AccountWithBalance[] = accounts.map((account) => {
    const balance = computeAccountBalance({
      accountId: account.id,
      accountCurrency: account.currencyCode,
      initialBalance: account.initialBalance,
      transactions: transactionsByAccount.get(account.id) ?? [],
    });

    const balanceInBaseCurrency =
      account.currencyCode === user.baseCurrencyCode
        ? balance
        : convertIfPossible(balance, user.baseCurrencyCode, ratesByCurrency.get(account.currencyCode));

    return {
      id: account.id,
      name: account.name,
      type: account.type,
      currencyCode: account.currencyCode,
      isLiquid: account.isLiquid,
      isSavings: account.isSavings,
      isActive: account.isActive,
      institutionKey: account.institutionKey,
      balance,
      balanceInBaseCurrency,
    };
  });

  let total = money("0", user.baseCurrencyCode);
  const missingRateFor = new Set<string>();
  for (const account of accountsWithBalance) {
    if (account.balanceInBaseCurrency) {
      total = addMoney(total, account.balanceInBaseCurrency);
    } else {
      missingRateFor.add(account.currencyCode);
    }
  }

  return {
    baseCurrencyCode: user.baseCurrencyCode,
    accounts: accountsWithBalance,
    total,
    missingRateFor: [...missingRateFor],
  };
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
  if (!rate) return null;
  return convertMoney(value, target, rate);
}
