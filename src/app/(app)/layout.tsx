import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth/auth";

// Shell de las pantallas autenticadas (Cuentas, Movimientos, y las que
// vengan en próximos milestones). Densidad sobre decoración — ver
// CLAUDE.md: nav mínimo, nada de sidebar pesado todavía.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/planilla" className="hover:underline">
            Planilla
          </Link>
          <Link href="/accounts" className="hover:underline">
            Cuentas
          </Link>
          <Link href="/ahorro" className="hover:underline">
            Ahorro
          </Link>
        </nav>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="text-sm text-muted-foreground underline underline-offset-4"
          >
            Cerrar sesión
          </button>
        </form>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
