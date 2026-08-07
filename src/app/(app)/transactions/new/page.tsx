import { redirect } from "next/navigation";

// [v2] Ver /transactions — el alta manual vive en la carga rápida de /planilla.
export default async function NewTransactionPage() {
  redirect("/planilla");
}
