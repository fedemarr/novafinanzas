import { prisma } from "./prisma";
import type { RateType } from "@/generated/prisma/client";
import type { RatePair } from "@/lib/domain/exchange-rate";

/**
 * Busca el rate vigente más reciente para un par de monedas + rateType,
 * en cualquiera de las dos direcciones en que pudo haberse guardado
 * (base/quote no tienen un orden canónico único — ver ExchangeRate en el
 * schema). Devuelve `null` si no hay ninguno — la capa de presentación
 * decide qué hacer con eso (invariante: mostrar el faltante, no ocultarlo).
 */
export async function findLatestRate(
  currencyA: string,
  currencyB: string,
  rateType: RateType,
): Promise<RatePair | null> {
  const direct = await prisma.exchangeRate.findFirst({
    where: {
      baseCurrencyCode: currencyA,
      quoteCurrencyCode: currencyB,
      rateType,
      deletedAt: null,
    },
    orderBy: { validAt: "desc" },
  });
  if (direct) {
    return {
      baseCurrencyCode: direct.baseCurrencyCode,
      quoteCurrencyCode: direct.quoteCurrencyCode,
      rate: direct.rate,
    };
  }

  const inverse = await prisma.exchangeRate.findFirst({
    where: {
      baseCurrencyCode: currencyB,
      quoteCurrencyCode: currencyA,
      rateType,
      deletedAt: null,
    },
    orderBy: { validAt: "desc" },
  });
  if (!inverse) return null;

  return {
    baseCurrencyCode: inverse.baseCurrencyCode,
    quoteCurrencyCode: inverse.quoteCurrencyCode,
    rate: inverse.rate,
  };
}
