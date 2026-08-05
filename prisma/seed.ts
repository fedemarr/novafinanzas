import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Seeds mínimos para que M0 sea usable: monedas + país por defecto (AR) +
// categorías del sistema + un par de rates de ejemplo. Todo con upsert para
// que correr el seed dos veces no duplique nada.

const CURRENCIES = [
  { code: "ARS", symbol: "$", decimals: 2, isCrypto: false },
  { code: "USD", symbol: "US$", decimals: 2, isCrypto: false },
  { code: "USDT", symbol: "₮", decimals: 2, isCrypto: true },
  { code: "BTC", symbol: "₿", decimals: 8, isCrypto: true },
] as const;

// [DECISIÓN] categorías del sistema — no venían definidas en PROJECT.md
// (queda anotado en la lista de decisiones pendientes). Es una taxonomía
// estándar de arranque, fácil de ajustar antes de M1.
const SYSTEM_CATEGORIES = [
  { name: "Comida", icon: "utensils", color: "#f97316" },
  { name: "Transporte", icon: "car", color: "#3b82f6" },
  { name: "Vivienda", icon: "home", color: "#8b5cf6" },
  { name: "Servicios", icon: "plug", color: "#06b6d4" },
  { name: "Salud", icon: "heart-pulse", color: "#ef4444" },
  { name: "Entretenimiento", icon: "clapperboard", color: "#ec4899" },
  { name: "Educación", icon: "graduation-cap", color: "#6366f1" },
  { name: "Ropa", icon: "shirt", color: "#14b8a6" },
  { name: "Suscripciones", icon: "refresh-cw", color: "#a855f7" },
  { name: "Ingresos", icon: "arrow-down-circle", color: "#22c55e" },
  { name: "Transferencias", icon: "arrow-left-right", color: "#64748b" },
  { name: "Otros", icon: "more-horizontal", color: "#94a3b8" },
] as const;

async function main() {
  for (const currency of CURRENCIES) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      create: currency,
      update: currency,
    });
  }

  await prisma.country.upsert({
    where: { code: "AR" },
    create: {
      code: "AR",
      name: "Argentina",
      defaultCurrencyCode: "ARS",
      defaultRateType: "BLUE",
    },
    update: {
      name: "Argentina",
      defaultCurrencyCode: "ARS",
      defaultRateType: "BLUE",
    },
  });

  for (const category of SYSTEM_CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: { name: category.name, isSystem: true, userId: null },
    });
    if (existing) {
      await prisma.category.update({
        where: { id: existing.id },
        data: { icon: category.icon, color: category.color },
      });
    } else {
      await prisma.category.create({
        data: { ...category, isSystem: true, userId: null },
      });
    }
  }

  const now = new Date();
  const exampleRates: Array<{
    baseCurrencyCode: string;
    quoteCurrencyCode: string;
    rateType: "OFFICIAL" | "BLUE";
    rate: string;
  }> = [
    { baseCurrencyCode: "USD", quoteCurrencyCode: "ARS", rateType: "OFFICIAL", rate: "1000.0000000000" },
    { baseCurrencyCode: "USD", quoteCurrencyCode: "ARS", rateType: "BLUE", rate: "1250.0000000000" },
  ];

  for (const rate of exampleRates) {
    await prisma.exchangeRate.upsert({
      where: {
        baseCurrencyCode_quoteCurrencyCode_rateType_validAt: {
          baseCurrencyCode: rate.baseCurrencyCode,
          quoteCurrencyCode: rate.quoteCurrencyCode,
          rateType: rate.rateType,
          validAt: now,
        },
      },
      create: { ...rate, validAt: now, source: "seed" },
      update: { rate: rate.rate, source: "seed" },
    });
  }

  console.log("Seed OK: monedas, país AR, categorías del sistema, rates de ejemplo.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
