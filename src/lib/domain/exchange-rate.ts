import Decimal from "decimal.js";
import { type CurrencyCode, type Money, money } from "./money";

/**
 * Un rate `ExchangeRate` en el schema es direccional: `rate` unidades de
 * `quoteCurrencyCode` equivalen a 1 `baseCurrencyCode`
 * (ej. base=USD, quote=ARS, rate=1000 → 1 USD = 1000 ARS).
 */
export interface RatePair {
  baseCurrencyCode: CurrencyCode;
  quoteCurrencyCode: CurrencyCode;
  rate: Decimal.Value;
}

/**
 * Convierte un monto usando un rate ya resuelto. Pura — no busca nada en
 * la DB, no sabe qué rateType corresponde. Eso lo resuelve la capa de
 * datos (ver los `queries.ts` de cada feature); acá solo vive la aritmética.
 */
export function convertMoney(value: Money, target: CurrencyCode, pair: RatePair): Money {
  if (value.currency === target) return value;

  const rate = new Decimal(pair.rate);

  if (value.currency === pair.baseCurrencyCode && target === pair.quoteCurrencyCode) {
    return money(value.amount.times(rate), target);
  }

  if (value.currency === pair.quoteCurrencyCode && target === pair.baseCurrencyCode) {
    return money(value.amount.dividedBy(rate), target);
  }

  throw new Error(
    `El rate ${pair.baseCurrencyCode}/${pair.quoteCurrencyCode} no sirve para convertir ${value.currency} → ${target}.`,
  );
}
