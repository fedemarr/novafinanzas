import type Decimal from "decimal.js";
import { type CurrencyCode, type Money, addMoney, money, subtractMoney } from "./money";
import { convertMoney, type RatePair } from "./exchange-rate";

/**
 * Vista mínima de una transacción que necesita el cálculo de balance —
 * desacoplada del modelo de Prisma a propósito (el dominio no depende de
 * la capa de datos). La capa de queries arma esto desde `Transaction` +
 * su `ExchangeRate` relacionado.
 */
export interface BalanceAffectingTransaction {
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  amount: Decimal.Value;
  currency: CurrencyCode;
  accountId: string;
  counterAccountId: string | null;
  /** Rate usado para convertir `amount`/`currency` a la moneda de la cuenta. */
  fxRate: RatePair | null;
}

export interface AccountBalanceInput {
  accountId: string;
  accountCurrency: CurrencyCode;
  initialBalance: Decimal.Value;
  /**
   * Transacciones donde esta cuenta participa, como `accountId` o como
   * `counterAccountId` (transferencias). Ya filtradas por `status:
   * CONFIRMED` y `deletedAt: null` — este módulo no filtra, solo suma.
   */
  transactions: BalanceAffectingTransaction[];
}

/**
 * Calcula el saldo de una cuenta en su propia moneda nativa (nunca
 * convertido — invariante #3). La conversión a baseCurrency para el total
 * consolidado es un paso aparte, en la capa de presentación.
 */
export function computeAccountBalance(input: AccountBalanceInput): Money {
  let balance = money(input.initialBalance, input.accountCurrency);

  for (const tx of input.transactions) {
    const inAccountCurrency = toAccountCurrency(
      money(tx.amount, tx.currency),
      input.accountCurrency,
      tx.fxRate,
    );

    if (tx.type === "EXPENSE") {
      balance = subtractMoney(balance, inAccountCurrency);
    } else if (tx.type === "INCOME") {
      balance = addMoney(balance, inAccountCurrency);
    } else {
      // TRANSFER: esta cuenta es el origen (sale plata) o el destino
      // (entra plata). M1 solo soporta transferencias entre cuentas de la
      // misma moneda — ver features/transactions/schemas.ts — así que acá
      // nunca hace falta fxRate para el lado del transfer.
      if (tx.accountId === input.accountId) {
        balance = subtractMoney(balance, inAccountCurrency);
      } else if (tx.counterAccountId === input.accountId) {
        balance = addMoney(balance, inAccountCurrency);
      }
    }
  }

  return balance;
}

function toAccountCurrency(
  txMoney: Money,
  accountCurrency: CurrencyCode,
  fxRate: RatePair | null,
): Money {
  if (txMoney.currency === accountCurrency) return txMoney;
  if (!fxRate) {
    throw new Error(
      `Transacción en ${txMoney.currency} sin fxRate para convertir a ${accountCurrency}.`,
    );
  }
  return convertMoney(txMoney, accountCurrency, fxRate);
}
