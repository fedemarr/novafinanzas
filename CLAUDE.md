# CLAUDE.md — Personal Finance OS

Documento de referencia operativa para trabajar en este repo. La fuente de
verdad de producto es [PROJECT.md](PROJECT.md) — leelo si falta contexto de
negocio. Este archivo es el resumen accionable para no releer todo cada vez.

## Qué es

App de finanzas personales para economías inestables (Argentina-first,
arquitectura global-ready). Asume multi-moneda, devaluación constante, y
cuotas/compromisos como instrumento financiero central. La pregunta que
responde: **¿cuánto puedo gastar hoy?**

## Stack (fijo — no proponer alternativas sin que el usuario lo pida)

```
Next.js 14+ App Router, TypeScript strict
Tailwind + shadcn/ui + Lucide
Framer Motion — solo transiciones <200ms, nada decorativo
TanStack Query (server state) + Zustand (client state, mínimo)
React Hook Form + Zod
Prisma + PostgreSQL
Redis (Upstash) + BullMQ (procesamiento de mails)
Auth.js (NextAuth)
Vitest — obligatorio en el motor de dinero (src/lib/domain/)
Vercel + Neon/Railway
```

## Archivos de agente

Este repo usa **AGENTS.md** en la raíz para las reglas específicas de Next.js
(`next dev` lo regenera solo — ver el bloque `BEGIN:nextjs-agent-rules` adentro;
commitear los cambios que reaparezcan ahí es normal, no un error). Las reglas
de producto y arquitectura del proyecto viven en **este** archivo, no en
AGENTS.md.

## Arquitectura

- **Feature-based**, no layer-based. Las carpetas se organizan por dominio
  (`cuentas/`, `movimientos/`, `compromisos/`), no por tipo técnico.
- Toda lógica de negocio vive en `src/lib/domain/`. **Nunca** en componentes
  React ni en route handlers — esos solo orquestan.
- El motor de dinero (`src/lib/domain/`) es la parte con más disciplina de
  testing del repo. Si tocás Safe-to-Spend, Runway o Poder Adquisitivo Real,
  no hay merge sin tests nuevos o actualizados.

## INVARIANTES DE DINERO — no negociables

Si una feature contradice alguna de estas reglas, la feature está mal
diseñada, no la regla. Pará y decilo antes de implementar.

1. **Nunca `float`/`number` para montos.** Prisma: `Decimal(30, 10)`. Cliente:
   strings o `decimal.js`. Cero aritmética nativa de JS sobre dinero.
2. **Ningún monto existe sin su moneda.** Un monto es siempre el par
   `(amount, currency)`. Una función que recibe un monto suelto está mal
   diseñada — refactorizala antes de usarla.
3. **Nunca se guarda un monto convertido.** Todo se persiste en su moneda
   nativa. La conversión ocurre en la capa de presentación, con el rate
   vigente en ese momento.
4. **Toda conversión guarda qué rate usó** (`fxRateId`). El histórico no se
   reescribe si el rate cambia mañana.
5. **Puede haber varios rates simultáneos para el mismo par** (oficial, blue,
   MEP, CCL...). `ExchangeRate.rateType` es explícito. El usuario elige cuál
   usa como referencia (`User.preferredRateType`).
6. **Nada de enums hardcodeados de países o monedas.** Tabla + seed, siempre.
7. **Toda tabla:** `id` (uuid), `created_at`, `updated_at`, `deleted_at`
   (soft delete). Ninguna query de producción debe traer filas con
   `deleted_at` seteado salvo que se pida explícitamente.
8. **Toda query de datos de usuario filtra por `userId`.** Sin excepción, sin
   "total global" implícito que cruce usuarios.

## Reglas de UI

- Densidad sobre decoración (referencia: Linear, no una landing page).
- Animaciones solo funcionales: <200ms, ease-out. Nada de gradientes
  animados, glassmorphism ni partículas.
- Mobile-first real. La pantalla "Hoy" se lee de un vistazo, sin scroll.
- Loading / error / empty state siempre resueltos — el empty state es la
  pantalla más importante de una app financiera nueva.
- Los montos siempre muestran su moneda. Nunca un número pelado.
- Dark mode desde el día uno, con tokens (no clases duplicadas por tema).

## Fuera de alcance en v1 — no implementar aunque parezca obvio

Presupuestos por sobres, gamificación (rachas/logros/niveles), chat de IA,
reportes/estadísticas como módulos separados, pantalla de patrimonio e
inversiones (el schema sí las contempla, la UI no), modo pareja/gastos
compartidos, billing y planes. Si se pide algo de esta lista antes de
terminar los milestones, recordarlo en vez de construirlo en silencio.

## Cómo trabajar en este repo

- **Milestone por milestone**, con checkpoint del usuario entre cada uno.
  Ver tabla de milestones en [PROJECT.md](PROJECT.md#8-milestones).
- Antes de cada milestone: presentar el plan y qué archivos se van a tocar.
- Código completo — sin `// acá va la lógica`, sin `any`.
- Al terminar un milestone: `typecheck` + `tests` + `lint` + commit, y parar.
  No arrancar el siguiente milestone sin que el usuario lo pida.
- No agregar features que no se pidieron, por obvias que parezcan.
- Si algo del plan está mal pensado técnicamente, decirlo antes de
  implementarlo — no ejecutar en silencio algo que se sabe que está mal.
- El schema de Prisma requiere aprobación explícita del usuario antes de
  correr cualquier migración.
