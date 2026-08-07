import { z } from "zod";

export const TRANSACTION_TYPES = ["EXPENSE", "INCOME", "TRANSFER"] as const;

export const TRANSACTION_TYPE_LABELS: Record<(typeof TRANSACTION_TYPES)[number], string> = {
  EXPENSE: "Gasto",
  INCOME: "Ingreso",
  TRANSFER: "Transferencia",
};

export const RATE_TYPES = ["OFFICIAL", "BLUE", "MEP", "CCL", "MARKET"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined));

export const transactionFormSchema = z
  .object({
    type: z.enum(TRANSACTION_TYPES),
    accountId: z.string().min(1, "Elegí una cuenta."),
    counterAccountId: optionalText(80),
    amount: z.string().min(1, "Ingresá un monto."),
    currencyCode: z.string().min(1, "Elegí una moneda."),
    occurredAt: z.string().min(1, "Elegí una fecha."),
    categoryId: optionalText(80),
    description: optionalText(200),
    notes: optionalText(1000),
    fxRateValue: optionalText(40),
    fxRateType: z.enum(RATE_TYPES).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "TRANSFER") {
      if (!data.counterAccountId) {
        ctx.addIssue({
          code: "custom",
          path: ["counterAccountId"],
          message: "Elegí la cuenta destino.",
        });
      } else if (data.counterAccountId === data.accountId) {
        ctx.addIssue({
          code: "custom",
          path: ["counterAccountId"],
          message: "La cuenta destino tiene que ser distinta a la de origen.",
        });
      }
    }
  });
