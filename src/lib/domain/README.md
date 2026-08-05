# src/lib/domain

Acá vive toda la lógica de negocio del producto — nunca en componentes React
ni en route handlers (ver CLAUDE.md).

Vacío a propósito en M0. Los motores de cálculo (Safe-to-Spend, Runway,
Poder Adquisitivo Real) entran en M3/M7. Cuando se agregue código acá:

- Todo monto es el par `(amount, currency)` — nunca un valor suelto.
- Nunca `number`/`float` para dinero — usar `decimal.js` en el cliente,
  `Prisma.Decimal` del lado del servidor.
- Tests unitarios obligatorios, con casos de multi-moneda, meses sin
  ingreso, y compromisos vencidos.
