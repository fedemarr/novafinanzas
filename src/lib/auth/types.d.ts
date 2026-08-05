import type { DefaultSession } from "next-auth";

// Augmentamos los tipos de Auth.js para que `session.user.id` exista sin
// castear a `any` en cada uso.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

// `next-auth/jwt` re-exporta desde acá (`export * from "@auth/core/jwt"`)
// sin re-declarar la interfaz — el merge tiene que apuntar al módulo real.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
  }
}
