import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth/auth";

// Placeholder de M0: solo prueba que login/sesión funcionan de punta a
// punta. La pantalla "Hoy" real (safe-to-spend + próximos compromisos)
// entra en M3.
export default async function HomePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-4">
      <p className="text-sm text-muted-foreground">Sesión iniciada como</p>
      <p className="text-lg font-medium">{session.user.email}</p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button type="submit" className="text-sm underline underline-offset-4">
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
