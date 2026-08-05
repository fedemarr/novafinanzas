import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "Ingresá tu email.").email("Email inválido."),
  password: z.string().min(1, "Ingresá tu contraseña."),
});

export const registerSchema = z
  .object({
    name: z.string().trim().max(120).optional().or(z.literal("")),
    email: z.string().min(1, "Ingresá tu email.").email("Email inválido."),
    password: z.string().min(8, "Mínimo 8 caracteres."),
    confirmPassword: z.string().min(8, "Mínimo 8 caracteres."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });
