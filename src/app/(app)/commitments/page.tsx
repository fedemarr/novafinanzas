import { redirect } from "next/navigation";

// [v2] Compromisos (M2) quedó fuera de la app v2. La ruta se mantiene solo
// para no romper links viejos y redirige a la planilla.
export default async function CommitmentsPage() {
  redirect("/planilla");
}
