import { redirect } from "next/navigation";

// [v2] Movimientos (M1) quedó fuera de la app v2: el ingreso de gastos ahora
// es la carga rápida de la planilla. La ruta se mantiene solo para no romper
// links viejos y redirige a la planilla.
export default async function TransactionsPage() {
  redirect("/planilla");
}
