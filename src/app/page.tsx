import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";

// La pantalla principal de la v2 (planilla de gastos) vive en /planilla.
// "/" solo decide a dónde mandar según la sesión.
export default async function HomePage() {
  const session = await auth();
  redirect(session?.user ? "/planilla" : "/login");
}
