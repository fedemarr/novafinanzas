# Prompt maestro — Personal Finance OS

> **Cómo usar este archivo:** guardalo en la raíz del repo como `PROJECT.md`.
> En Claude Code, arrancá con el bloque "Prompt inicial" y después andá pidiendo
> milestone por milestone. No pidas todo junto.

---

## PROMPT INICIAL (pegar en Claude Code)

```
Vas a construir conmigo un producto llamado [NOMBRE]: un sistema de finanzas
personales. Leé este documento completo antes de escribir una sola línea de código.

Tu primera tarea NO es programar. Es:
1. Leer todo este documento.
2. Generar un CLAUDE.md en la raíz con las reglas de arquitectura y las
   invariantes de dinero que están más abajo.
3. Listarme las decisiones que faltan definir y las contradicciones que
   encuentres en este documento.
4. Proponerme el schema de Prisma completo para revisión, ANTES de implementarlo.

No avances al Milestone 1 hasta que yo apruebe el schema explícitamente.

Trabajamos milestone por milestone. Al terminar cada uno: corré typecheck,
tests y lint, hacé commit, y frená. No arranques el siguiente sin que yo lo pida.

Si algo del documento te parece una mala decisión técnica, decímelo antes de
implementarlo. No quiero que ejecutes en silencio algo que sabés que está mal.
```

---

## 1. Qué es el producto

Una app de finanzas personales para **economías inestables**. La diferencia
con Copilot / Monarch / YNAB es que asume tres cosas que ninguna app global asume:

- El usuario piensa en **dos o más monedas al mismo tiempo**.
- La moneda local **pierde valor**, así que los montos nominales mienten.
- Existen **cuotas** como instrumento financiero central.

**La pregunta que responde el producto:** *¿cuánto puedo gastar hoy?*
Todo lo demás existe para que ese número sea confiable.

**Usuario objetivo v1:** Argentina, 25–38, ingreso formal o mixto, ahorra en
USD o cripto, usa 2–4 apps financieras a la vez.

**Producto Argentina-first, arquitectura global-ready.** Nada de ARS hardcodeado,
nada de "el país es Argentina" asumido en el código.

---

## 2. Stack (fijo, no negociable)

```
Framework:   Next.js 14+ App Router, TypeScript strict
UI:          Tailwind + shadcn/ui + Lucide
Animación:   Framer Motion — SOLO transiciones <200ms. Nada decorativo.
Estado:      TanStack Query (server) + Zustand (client, mínimo)
Forms:       React Hook Form + Zod
ORM:         Prisma
DB:          PostgreSQL
Cache/Queue: Redis (Upstash) + BullMQ para procesamiento de mails
Auth:        Auth.js (NextAuth)
Tests:       Vitest — obligatorios en el motor de dinero
Deploy:      Vercel + Neon/Railway
```

Estructura de carpetas: feature-based, no layer-based.
Lógica de negocio en `src/lib/domain/`, nunca en componentes React.

---

## 3. INVARIANTES DE DINERO (esto va sí o sí en CLAUDE.md)

Estas reglas no se rompen nunca. Si una feature las contradice, la feature está mal.

1. **Nunca `float` ni `number` para montos.** Prisma `Decimal(30, 10)`.
   En el cliente, strings o decimal.js. Nunca aritmética de JS sobre dinero.
2. **Ningún monto existe sin su moneda.** Todo monto es el par `(amount, currency)`.
   Si una función recibe un monto suelto, está mal diseñada.
3. **Nunca se guarda un monto convertido.** Se guarda en su moneda nativa.
   La conversión pasa en la capa de presentación, con el rate del momento.
4. **Toda conversión guarda qué rate usó.** `fxRateId` en la transacción.
   Si mañana cambia el rate, el histórico no se reescribe.
5. **Puede haber varios rates simultáneos para el mismo par.** ARS→USD tiene
   oficial, blue, MEP, CCL. `ExchangeRate` tiene un campo `rateType`. El usuario
   elige cuál usa como referencia.
6. **Nada de enums hardcodeados de países o monedas.** Todo es tabla + seed.
7. **Toda tabla:** `id` (uuid), `created_at`, `updated_at`, `deleted_at` (soft delete).
8. **Toda query de datos de usuario filtra por `userId`.** Sin excepción.

---

## 4. Modelo de datos

Proponé el schema completo de Prisma con esto como base. Agregá índices,
constraints y relaciones que falten, y decime qué agregaste y por qué.

### Core

**User** — email, name, `baseCurrency`, `countryCode`, `locale`, `timezone`,
`preferredRateType`, `payCycleDay` (día de cobro), `ingestAddress` (alias único
para recibir mails)

**Currency** — `code` (ISO 4217 o cripto), `symbol`, `decimals`, `isCrypto`

**ExchangeRate** — `baseCurrency`, `quoteCurrency`, `rateType` (OFFICIAL | BLUE |
MEP | CCL | MARKET), `rate` (Decimal), `validAt`, `source`
→ índice único en (base, quote, rateType, validAt)

**InflationIndex** — `countryCode`, `period` (YYYY-MM), `indexValue`, `source`
→ para calcular poder adquisitivo real

### Cuentas y movimientos

**Account** — `userId`, `name`, `type` (BANK | WALLET | CASH | CRYPTO |
INVESTMENT | CREDIT_CARD), `currency`, `institutionKey`, `isLiquid` (bool),
`initialBalance`, `isActive`

> `isLiquid` importa: define qué entra en el cálculo de safe-to-spend y runway.

**Transaction** — `userId`, `accountId`, `type` (EXPENSE | INCOME | TRANSFER),
`amount` (Decimal), `currency`, `fxRateId`, `occurredAt`, `description`,
`merchantRaw`, `merchantNormalized`, `categoryId`, `status` (PENDING_REVIEW |
CONFIRMED | IGNORED), `source` (EMAIL | IMPORT | MANUAL | RECURRING),
`sourceRef`, `dedupeHash`, `counterAccountId`, `commitmentOccurrenceId`, `notes`

> Gastos, ingresos y transferencias son **la misma tabla**. El tipo es un campo.
> `dedupeHash` es crítico: el mismo consumo puede llegar por mail Y por resumen.
> Hash de (userId, accountId, amount, currency, fecha±1d, merchant normalizado).

**Category** — `userId` (null = categoría del sistema), `name`, `icon`, `color`,
`parentId`, `isSystem`

### Compromisos (el módulo clave)

Unifica tarjetas + cuotas + suscripciones + gastos fijos + préstamos.
Todo eso es lo mismo: **plata futura que ya no es tuya.**

**Commitment** — `userId`, `kind` (CARD_INSTALLMENT | SUBSCRIPTION |
FIXED_EXPENSE | LOAN | DEBT), `name`, `accountId`, `currency`, `totalAmount`,
`startDate`, `endDate`, `recurrenceRule` (RRULE o simple), `isActive`

**CommitmentOccurrence** — `commitmentId`, `dueDate`, `amount`, `currency`,
`status` (SCHEDULED | PAID | SKIPPED | OVERDUE), `transactionId` (nullable,
se linkea cuando matchea con un movimiento real), `installmentNumber`,
`installmentTotal`

> Las ocurrencias se **materializan** en la DB (no se calculan al vuelo).
> Sin esto no podés hacer la línea de tiempo de 12 meses ni el matching
> contra transacciones reales.

### Objetivos

**Goal** — `userId`, `name`, `targetAmount`, `currency`, `targetDate`,
`accountId`, `monthlyContribution`, `status`, `priority`

> El aporte mensual **descuenta del safe-to-spend**. Ese acoplamiento es lo que
> hace que los objetivos no sean decorativos.

### Ingesta

**InboundMessage** — `userId`, `receivedAt`, `fromAddress`, `subject`,
`rawBody`, `parserKey`, `parseStatus` (PENDING | PARSED | FAILED | IGNORED),
`transactionId`, `errorDetail`

**BalanceSnapshot** — `userId`, `accountId`, `date`, `balance`, `currency`
→ job diario. Sin esto no hay gráfico de evolución de patrimonio.

---

## 5. Motores de cálculo (`src/lib/domain/`)

Estos tres son el corazón del producto. **Tests unitarios obligatorios**, con
casos de multi-moneda, meses sin ingreso, y compromisos vencidos.

### 5.1 Safe-to-Spend

```
disponible        = Σ balances de cuentas con isLiquid = true (en baseCurrency)
ingresosPrevistos = Σ ingresos recurrentes con fecha < próximo cobro
comprometido      = Σ CommitmentOccurrence SCHEDULED con dueDate < próximo cobro
aporteObjetivos   = Σ monthlyContribution prorrateado por días restantes
díasRestantes     = días hasta el próximo ingreso (payCycleDay)

safeToSpendTotal  = disponible + ingresosPrevistos - comprometido - aporteObjetivos
safeToSpendDiario = safeToSpendTotal / díasRestantes
```

Casos borde a resolver: sin ingreso recurrente cargado, safe-to-spend negativo
(mostrar el déficit, no un cero), primer mes sin histórico.

### 5.2 Runway

```
gastoMensualPromedio = promedio de gastos de los últimos 3 meses,
                       ajustado por inflación a valor de hoy
runwayMeses          = patrimonioLíquido / gastoMensualPromedio
```

### 5.3 Poder adquisitivo real

```
patrimonioReal(t) = patrimonioNominal(t) × (índiceInflación(hoy) / índiceInflación(t))
```

Devolver las tres series: nominal, ajustada por inflación, y en USD.
Es el gráfico que dice *"en pesos creciste 40%, en poder de compra perdiste 8%"*.

---

## 6. Alcance v1 — cinco pantallas

**1. Hoy** — un número grande (safe-to-spend diario) + los próximos 3
compromisos. Nada más. Si necesita scroll, está mal.

**2. Movimientos** — feed unificado. Incluye triage: las transacciones que
entraron por mail y esperan confirmación de categoría (swipe, <20s por día).

**3. Cuentas** — multi-moneda, saldo por cuenta y total consolidado.

**4. Compromisos** — línea de tiempo de 12 meses. Cuánto debo cada mes y por qué.

**5. Objetivos** — progreso, acoplado al safe-to-spend.

### Lo que NO se construye en v1

- Presupuestos por sobres (el safe-to-spend *es* el presupuesto)
- Gamificación: nada de rachas, logros ni niveles
- Chat de IA / copiloto
- Reportes, estadísticas e historial como módulos separados
- Patrimonio e inversiones como pantalla (schema sí, UI no)
- Modo pareja / gastos compartidos
- Billing y planes

Si te pido algo de esta lista antes de terminar los milestones, recordámelo.

---

## 7. Reglas de UI

- **Densidad sobre decoración.** La referencia es Linear, no una landing page.
- Animaciones solo funcionales: <200ms, ease-out. Nada de gradientes animados,
  glassmorphism ni partículas.
- Mobile-first real. La pantalla "Hoy" tiene que leerse de un vistazo.
- Loading / error / empty states siempre resueltos. El empty state de una app
  financiera nueva es la pantalla más importante del producto.
- Los montos se muestran con la moneda siempre visible. Nunca un número pelado.
- Dark mode desde el inicio (tokens, no clases duplicadas).

---

## 8. Milestones

Uno por vez. Checkpoint mío entre cada uno.

| # | Milestone | Terminado cuando |
|---|-----------|------------------|
| **M0** | Setup, auth, schema, seeds (monedas, categorías, rates iniciales) | `prisma migrate` corre limpio, login funciona |
| **M1** | Cuentas + Movimientos manuales, multi-moneda | Puedo cargar un gasto en USD desde una cuenta en ARS y el total consolida bien |
| **M2** | Compromisos + timeline 12 meses | Cargo una compra en 12 cuotas y veo el impacto mes a mes |
| **M3** | Motor Safe-to-Spend + pantalla Hoy | El número aparece y los tests del motor pasan |
| **M4** | Ingesta por email (webhook + parsers + cola + triage) | Reenvío un mail de banco y aparece la transacción para confirmar |
| **M5** | Import de resúmenes CSV/PDF + backfill histórico | Importo un resumen y detecta cuotas sin duplicar lo que ya entró por mail |
| **M6** | Objetivos acoplados al safe-to-spend | Creo un objetivo y el número de "Hoy" baja |
| **M7** | Runway + poder adquisitivo real | Los tres gráficos (nominal / real / USD) |

### Nota sobre M4 — ingesta por email

Es el milestone que define si el producto vive o muere, y el más subestimado.

- Casilla dedicada por usuario (`u-a8f3@dominio.com`). El usuario configura una
  regla de reenvío en Gmail **una sola vez**.
- **No usar OAuth de Gmail.** El scope `gmail.readonly` exige verificación CASA
  de Google (auditoría, plata, semanas). El reenvío no exige nada.
- Inbound: Cloudflare Email Workers, Postmark o Resend → webhook.
- Parsers como estrategias por institución (`parsers/santander.ts`,
  `parsers/mercadopago.ts`), con un registry y fallback a
  `parseStatus: FAILED` para revisión manual. **Nunca inventar un monto.**
- Todo el parseo va a una cola (BullMQ), no al request del webhook.
- Empezá con UN parser andando end-to-end antes de escribir el segundo.

---

## 9. Cómo quiero que trabajes

- Antes de cada milestone: contame el plan y qué archivos vas a tocar.
- Código completo, sin `// acá va la lógica`, sin `any`.
- Al terminar: typecheck + tests + lint + commit, y frenás.
- Si detectás que algo del documento está mal pensado, decímelo. Prefiero
  discutir una decisión que descubrir el error tres milestones después.
- No agregues features que no pedí, ni siquiera si te parecen obvias.
