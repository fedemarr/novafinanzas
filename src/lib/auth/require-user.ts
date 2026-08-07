import { auth } from "./auth";

/** Para usar en Server Components / Server Actions que necesitan al usuario logueado. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("No autenticado.");
  }
  return session.user.id;
}
