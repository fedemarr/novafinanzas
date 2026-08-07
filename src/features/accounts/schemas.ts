import { z } from "zod";

export const ACCOUNT_TYPES = [
  "BANK",
  "WALLET",
  "CASH",
  "CRYPTO",
  "INVESTMENT",
  "CREDIT_CARD",
] as const;

export const ACCOUNT_TYPE_LABELS: Record<(typeof ACCOUNT_TYPES)[number], string> = {
  BANK: "Banco",
  WALLET: "Billetera virtual",
  CASH: "Efectivo",
  CRYPTO: "Cripto",
  INVESTMENT: "Inversión",
  CREDIT_CARD: "Tarjeta de crédito",
};

const institutionKeyField = z
  .string()
  .trim()
  .max(80)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

export const accountFormSchema = z.object({
  name: z.string().trim().min(1, "Ingresá un nombre.").max(80),
  type: z.enum(ACCOUNT_TYPES),
  currencyCode: z.string().min(1, "Elegí una moneda."),
  institutionKey: institutionKeyField,
  isLiquid: z.coerce.boolean(),
  initialBalance: z.string().min(1, "Ingresá un saldo inicial."),
});

// La moneda no se puede editar después de creada: cambiarla retroactivamente
// rompería el cálculo de balance de todas las transacciones ya cargadas
// (cada una asume que la cuenta está en una moneda fija — ver
// src/lib/domain/account-balance.ts).
export const accountEditSchema = z.object({
  name: z.string().trim().min(1, "Ingresá un nombre.").max(80),
  type: z.enum(ACCOUNT_TYPES),
  institutionKey: institutionKeyField,
  isLiquid: z.coerce.boolean(),
  isActive: z.coerce.boolean(),
  initialBalance: z.string().min(1, "Ingresá un saldo inicial."),
});
