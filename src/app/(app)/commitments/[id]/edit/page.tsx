import { redirect } from "next/navigation";

// [v2] Ver /commitments — fuera de la app v2.
export default async function EditCommitmentPage() {
  redirect("/planilla");
}
