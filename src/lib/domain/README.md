# src/lib/domain

Lógica de negocio pura — nunca en componentes React ni en route handlers
(ver CLAUDE.md). Todo lo que toca dinero acá adentro tiene tests.

- `money.ts` — tipo `Money` (par amount+currency), parseo de input de
  usuario, suma/resta (solo misma moneda).
- `exchange-rate.ts` — conversión pura dado un rate ya resuelto. No
  consulta la DB — eso vive en `features/*/queries.ts`.
- `account-balance.ts` — balance de una cuenta a partir de su saldo
  inicial + transacciones (M1).
- `commitment.ts` — generación de ocurrencias de compromisos (M2): cuotas
  con resto en la última, recurrentes vía RRULE, horizonte de 12 meses.
- `dedupe-hash.ts` — hash determinístico para detectar duplicados exactos.
  El matching difuso (±1 día, mail vs. resumen) es una query aparte, no
  este hash — se resuelve en M4/M5.

Pendiente (fuera de alcance hasta su milestone): Safe-to-Spend (M3),
Runway y Poder Adquisitivo Real (M7).
