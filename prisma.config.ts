import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7: la URL de conexión para `prisma migrate`/`prisma db push` vive
// acá, no en schema.prisma. PrismaClient en runtime usa su propio driver
// adapter — ver src/lib/db/prisma.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
