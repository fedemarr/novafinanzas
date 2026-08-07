import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";

// La pantalla "Hoy" (safe-to-spend + próximos compromisos) vive en /today
// desde M3. "/" solo decide a dónde mandar según la sesión.
export default async function HomePage() {
  const session = await auth();
  redirect(session?.user ? "/today" : "/login");
}
