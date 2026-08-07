import { redirect } from "next/navigation";

// [v2] La pantalla "Hoy" (safe-to-spend, M3) quedó fuera de la app v2: el
// producto ahora es planilla mensual + ahorro. La ruta se mantiene solo para
// no romper links viejos y redirige a la planilla.
export default async function TodayPage() {
  redirect("/planilla");
}
