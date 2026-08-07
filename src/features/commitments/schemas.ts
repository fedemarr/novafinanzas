import { z } from "zod";
import { FINITE_KINDS, RECURRING_KINDS, type CommitmentKind } from "@/lib/domain/commitment";

export const COMMITMENT_KINDS = [...FINITE_KINDS, ...RECURRING_KINDS] as const;

export const COMMITMENT_KIND_LABELS: Record<CommitmentKind, string> = {
  CARD_INSTALLMENT: "Tarjeta / cuotas",
  LOAN: "Préstamo",
  DEBT: "Deuda",
  SUBSCRIPTION: "Suscripción",
  FIXED_EXPENSE: "Gasto fijo",
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined));

const MAX_INSTALLMENTS = 120;

export const commitmentFormSchema = z
  .object({
    kind: z.enum(COMMITMENT_KINDS),
    name: z.string().trim().min(1, "Ingresá un nombre.").max(120),
    accountId: z.string().min(1, "Elegí una cuenta."),
    currencyCode: z.string().min(1, "Elegí una moneda."),
    totalAmount: z.string().min(1, "Ingresá un monto."),
    installmentTotal: optionalText(3),
    startDate: z.string().min(1, "Elegí la fecha de inicio."),
    endDate: optionalText(10),
    isActive: z.coerce.boolean(),
  })
  .superRefine((data, ctx) => {
    const isFinite = FINITE_KINDS.includes(data.kind as (typeof FINITE_KINDS)[number]);
    if (isFinite) {
      if (!data.installmentTotal) {
        ctx.addIssue({
          code: "custom",
          path: ["installmentTotal"],
          message: "Ingresá la cantidad de cuotas.",
        });
      } else {
        const n = Number(data.installmentTotal);
        if (!Number.isInteger(n) || n < 2) {
          ctx.addIssue({
            code: "custom",
            path: ["installmentTotal"],
            message: "Las cuotas tienen que ser un número entero de al menos 2.",
          });
        } else if (n > MAX_INSTALLMENTS) {
          ctx.addIssue({
            code: "custom",
            path: ["installmentTotal"],
            message: `No se pueden cargar más de ${MAX_INSTALLMENTS} cuotas.`,
          });
        }
      }
    } else if (data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "La fecha de fin no puede ser anterior a la de inicio.",
      });
    }
  });

export type CommitmentFormData = z.infer<typeof commitmentFormSchema>;
