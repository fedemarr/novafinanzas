import Decimal from "decimal.js";

// [INVARIANTE #1] Nunca float/number para montos. Todo pasa por acá.
// Prisma.Decimal es literalmente decimal.js por debajo (mismo paquete,
// re-exportado desde el runtime de Prisma), así que estas instancias son
// intercambiables con los campos Decimal del schema sin conversión.
Decimal.set({ precision: 40 });

export type CurrencyCode = string;

/** [INVARIANTE #2] Un monto nunca existe sin su moneda — siempre el par. */
export interface Money {
  amount: Decimal;
  currency: CurrencyCode;
}

export function money(amount: Decimal.Value, currency: CurrencyCode): Money {
  return { amount: new Decimal(amount), currency };
}

/** Parsea un input de usuario (string de un form) a Decimal. Sin signo. */
export function parseDecimalInput(raw: string): Decimal {
  const trimmed = raw.trim().replace(",", ".");
  if (trimmed === "" || Number.isNaN(Number(trimmed))) {
    throw new Error("Monto inválido.");
  }
  return new Decimal(trimmed);
}

/**
 * Como `parseDecimalInput`, pero rechaza negativos/cero — para montos de
 * transacción, donde la UI decide el signo según el tipo (EXPENSE/INCOME),
 * nunca lo escribe el usuario. `Account.initialBalance` usa
 * `parseDecimalInput` directo: un saldo inicial negativo es válido (ej.
 * deuda de tarjeta de crédito).
 */
export function parseAmountInput(raw: string): Decimal {
  const value = parseDecimalInput(raw);
  if (value.isNegative() || value.isZero()) {
    throw new Error("El monto tiene que ser mayor a cero.");
  }
  return value;
}

/** Suma/resta solo tiene sentido entre montos de la misma moneda. */
export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(
      `No se puede sumar ${a.currency} con ${b.currency} sin convertir primero.`,
    );
  }
  return money(a.amount.plus(b.amount), a.currency);
}

export function subtractMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(
      `No se puede restar ${b.currency} de ${a.currency} sin convertir primero.`,
    );
  }
  return money(a.amount.minus(b.amount), a.currency);
}

export function formatMoney(
  value: Money,
  currencyMeta: { symbol: string; decimals: number },
): string {
  return `${currencyMeta.symbol} ${value.amount.toFixed(currencyMeta.decimals)}`;
}
