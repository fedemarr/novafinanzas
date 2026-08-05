"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { signIn } from "@/lib/auth/auth";
import { generateIngestAddress } from "@/lib/ingest/generate-ingest-address";
import { loginSchema, registerSchema } from "./schemas";

// [DECISIÓN] defaults de registro Argentina-first (ver PROJECT.md sección 1:
// "Producto Argentina-first, arquitectura global-ready"). M0 no incluye un
// selector de país en el onboarding — eso es una feature de UI que no se
// pidió todavía. Si se agrega, esto deja de hardcodearse y pasa a venir del
// form.
const DEFAULT_COUNTRY_CODE = "AR";
const DEFAULT_PAY_CYCLE_DAY = 1;
const DEFAULT_LOCALE = "es-AR";
const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires";
const MAX_INGEST_ADDRESS_ATTEMPTS = 5;

export type LoginState = { error: string | null };
export type RegisterState = { error: string | null };

export async function loginUser(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error:
          error.type === "CredentialsSignin"
            ? "Email o contraseña incorrectos."
            : "No se pudo iniciar sesión.",
      };
    }
    // next-auth usa una excepción especial para redirigir en éxito — hay
    // que dejarla propagar, no es un error real.
    throw error;
  }

  return { error: null };
}

export async function registerUser(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Ya existe una cuenta con ese email." };
  }

  const country = await prisma.country.findUnique({
    where: { code: DEFAULT_COUNTRY_CODE },
  });
  if (!country) {
    return {
      error: `Falta correr los seeds (no existe el país ${DEFAULT_COUNTRY_CODE}). Corré \`npm run db:seed\`.`,
    };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  let created = false;
  for (let attempt = 0; attempt < MAX_INGEST_ADDRESS_ATTEMPTS && !created; attempt++) {
    try {
      await prisma.user.create({
        data: {
          email,
          name: name || null,
          passwordHash,
          baseCurrencyCode: country.defaultCurrencyCode,
          countryCode: country.code,
          locale: DEFAULT_LOCALE,
          timezone: DEFAULT_TIMEZONE,
          preferredRateType: country.defaultRateType ?? "OFFICIAL",
          payCycleDay: DEFAULT_PAY_CYCLE_DAY,
          ingestAddress: generateIngestAddress(),
        },
      });
      created = true;
    } catch (err) {
      if (!isIngestAddressCollision(err)) throw err;
      // alias aleatorio ya usado — reintenta con uno nuevo
    }
  }

  if (!created) {
    return { error: "No se pudo generar una casilla de ingesta única. Reintentá." };
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Cuenta creada. Iniciá sesión desde /login." };
    }
    throw error;
  }

  return { error: null };
}

function isIngestAddressCollision(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (err.code !== "P2002") return false;
  const target = err.meta?.target;
  const targets = Array.isArray(target) ? target.map(String) : [String(target)];
  return targets.some((t) => t.toLowerCase().includes("ingest"));
}
