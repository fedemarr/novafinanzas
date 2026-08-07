import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";

// La pantalla "Hoy" real (safe-to-spend + próximos compromisos) entra en
// M3. Hasta entonces, "/" solo decide a dónde mandar según la sesión.
export default async function HomePage() {
  const session = await auth();
  redirect(session?.user ? "/accounts" : "/login");
}
