import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  addMonthsUtc,
  buildMonthlyRecurrenceRule,
  buildOccurrenceDrafts,
  commitmentHorizonEnd,
  splitIntoInstallments,
  type CommitmentSpec,
} from "../commitment";

const start = (iso: string) => new Date(iso);

const finiteSpec = (overrides: Partial<CommitmentSpec> = {}): CommitmentSpec => ({
  kind: "CARD_INSTALLMENT",
  totalAmount: "120000",
  currency: "ARS",
  decimals: 2,
  startDate: start("2026-08-05T00:00:00Z"),
  endDate: null,
  installmentTotal: 12,
  recurrenceRule: null,
  ...overrides,
});

const recurringSpec = (overrides: Partial<CommitmentSpec> = {}): CommitmentSpec => ({
  kind: "SUBSCRIPTION",
  totalAmount: "5000",
  currency: "ARS",
  decimals: 2,
  startDate: start("2026-08-05T00:00:00Z"),
  endDate: null,
  installmentTotal: null,
  recurrenceRule: "FREQ=MONTHLY;BYMONTHDAY=5",
  ...overrides,
});

describe("splitIntoInstallments", () => {
  it("reparte 10000 en 3 cuotas con el resto en la última", () => {
    const parts = splitIntoInstallments(new Decimal("10000"), 3, 2);
    expect(parts.map((p) => p.toString())).toEqual(["3333.33", "3333.33", "3333.34"]);
  });

  it("la suma de cuotas es exactamente el total (sin perder centavos)", () => {
    const total = new Decimal("10000");
    const parts = splitIntoInstallments(total, 12, 2);
    const sum = parts.reduce((acc, p) => acc.plus(p), new Decimal(0));
    expect(sum.toString()).toBe("10000");
    expect(parts.length).toBe(12);
  });

  it("con una sola cuota devuelve el total sin tocar", () => {
    const parts = splitIntoInstallments(new Decimal("9999.99"), 1, 2);
    expect(parts.map((p) => p.toString())).toEqual(["9999.99"]);
  });

  it("mantiene 8 decimales para cripto", () => {
    const parts = splitIntoInstallments(new Decimal("1"), 3, 8);
    expect(parts[0].toString()).toBe("0.33333333");
    expect(parts[2].toString()).toBe("0.33333334");
  });
});

describe("buildOccurrenceDrafts — cuotas (CARD_INSTALLMENT)", () => {
  it("genera exactamente installmentTotal cuotas mensuales desde startDate", () => {
    const drafts = buildOccurrenceDrafts(finiteSpec(), commitmentHorizonEnd());
    expect(drafts).toHaveLength(12);
    expect(drafts[0].dueDate.toISOString().slice(0, 10)).toBe("2026-08-05");
    expect(drafts[11].dueDate.toISOString().slice(0, 10)).toBe("2027-07-05");
  });

  it("cada cuota lleva su número y el total, y suma el total financiado", () => {
    const drafts = buildOccurrenceDrafts(
      finiteSpec({ totalAmount: "120000", installmentTotal: 12 }),
      commitmentHorizonEnd(),
    );
    expect(drafts[0].installmentNumber).toBe(1);
    expect(drafts[11].installmentNumber).toBe(12);
    expect(drafts[0].installmentTotal).toBe(12);
    const sum = drafts.reduce((acc, d) => acc.plus(d.amount.amount), new Decimal(0));
    expect(sum.toString()).toBe("120000");
    expect(drafts[0].amount.currency).toBe("ARS");
  });

  it("10000 en 3 cuotas: 3333.33, 3333.33, 3333.34 (resto en la última)", () => {
    const drafts = buildOccurrenceDrafts(
      finiteSpec({ totalAmount: "10000", installmentTotal: 3 }),
      commitmentHorizonEnd(),
    );
    expect(drafts.map((d) => d.amount.amount.toString())).toEqual([
      "3333.33",
      "3333.33",
      "3333.34",
    ]);
  });

  it("satura el fin de mes: 31 ene + 1 mes = 28 feb", () => {
    const drafts = buildOccurrenceDrafts(
      finiteSpec({
        startDate: start("2026-01-31T00:00:00Z"),
        installmentTotal: 2,
      }),
      commitmentHorizonEnd(),
    );
    expect(drafts[0].dueDate.toISOString().slice(0, 10)).toBe("2026-01-31");
    expect(drafts[1].dueDate.toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("un LOAN usa el mismo motor de cuotas", () => {
    const drafts = buildOccurrenceDrafts(
      finiteSpec({ kind: "LOAN", totalAmount: "500000", installmentTotal: 6 }),
      commitmentHorizonEnd(),
    );
    expect(drafts).toHaveLength(6);
    expect(drafts[0].amount.amount.toString()).toBe("83333.33");
    expect(drafts[5].amount.amount.toString()).toBe("83333.35");
  });

  it("tira error si falta installmentTotal", () => {
    expect(() =>
      buildOccurrenceDrafts(finiteSpec({ installmentTotal: null }), commitmentHorizonEnd()),
    ).toThrow(/cuotas/);
  });
});

describe("buildOccurrenceDrafts — recurrentes (SUBSCRIPTION / FIXED_EXPENSE)", () => {
  it("genera ocurrencias mensuales desde startDate hasta el horizonte", () => {
    const horizon = commitmentHorizonEnd(start("2026-08-07T00:00:00Z"), 12);
    const drafts = buildOccurrenceDrafts(recurringSpec(), horizon);
    expect(drafts[0].dueDate.toISOString().slice(0, 10)).toBe("2026-08-05");
    // La ventana es inclusiva: horizonte = 2027-08-07, así que la de ago 2027
    // (el mes borde del +12) también entra. La pantalla timeline muestra solo
    // 12 meses filtrando por mes, así que el borde no se ve.
    expect(drafts).toHaveLength(13);
    expect(drafts[12].dueDate.toISOString().slice(0, 10)).toBe("2027-08-05");
  });

  it("cada ocurrencia recurrente vale totalAmount (monto por período)", () => {
    const drafts = buildOccurrenceDrafts(recurringSpec(), commitmentHorizonEnd());
    for (const d of drafts) {
      expect(d.amount.amount.toString()).toBe("5000");
      expect(d.amount.currency).toBe("ARS");
      expect(d.installmentNumber).toBeNull();
      expect(d.installmentTotal).toBeNull();
    }
  });

  it("respeta endDate cuando es antes que el horizonte", () => {
    const drafts = buildOccurrenceDrafts(
      recurringSpec({ endDate: start("2026-12-31T00:00:00Z") }),
      commitmentHorizonEnd(),
    );
    expect(drafts).toHaveLength(5); // ago, sep, oct, nov, dic 2026
    expect(drafts[4].dueDate.toISOString().slice(0, 10)).toBe("2026-12-05");
  });

  it("un FIXED_EXPENSE arrancando el 15 factura el 15 de cada mes", () => {
    const drafts = buildOccurrenceDrafts(
      recurringSpec({
        kind: "FIXED_EXPENSE",
        startDate: start("2026-08-15T00:00:00Z"),
        recurrenceRule: "FREQ=MONTHLY;BYMONTHDAY=15",
      }),
      commitmentHorizonEnd(start("2026-08-16T00:00:00Z"), 3),
    );
    // Ventana inclusiva 2026-08-15..2026-11-16 → 4 mensualidades
    expect(drafts.map((d) => d.dueDate.toISOString().slice(0, 10))).toEqual([
      "2026-08-15",
      "2026-09-15",
      "2026-10-15",
      "2026-11-15",
    ]);
  });

  it("tira error si falta la recurrenceRule", () => {
    expect(() =>
      buildOccurrenceDrafts(recurringSpec({ recurrenceRule: null }), commitmentHorizonEnd()),
    ).toThrow(/recurrencia/);
  });
});

describe("validaciones compartidas", () => {
  it("rechaza monto cero o negativo", () => {
    expect(() =>
      buildOccurrenceDrafts(finiteSpec({ totalAmount: "0" }), commitmentHorizonEnd()),
    ).toThrow(/mayor a cero/);
    expect(() =>
      buildOccurrenceDrafts(recurringSpec({ totalAmount: "-1" }), commitmentHorizonEnd()),
    ).toThrow(/mayor a cero/);
  });

  it("rechaza endDate anterior a startDate", () => {
    expect(() =>
      buildOccurrenceDrafts(
        recurringSpec({ endDate: start("2026-07-01T00:00:00Z") }),
        commitmentHorizonEnd(),
      ),
    ).toThrow(/fecha de fin/);
  });

  it("un compromiso multi-moneda mantiene su moneda en las cuotas (invariante #2)", () => {
    const drafts = buildOccurrenceDrafts(
      finiteSpec({ currency: "USD", totalAmount: "100", installmentTotal: 12, decimals: 2 }),
      commitmentHorizonEnd(),
    );
    expect(drafts[0].amount.currency).toBe("USD");
    expect(drafts[11].amount.currency).toBe("USD");
  });
});

describe("helpers de fechas", () => {
  it("addMonthsUtc suma meses saturando el último día", () => {
    expect(addMonthsUtc(start("2026-01-31T00:00:00Z"), 1).toISOString().slice(0, 10)).toBe(
      "2026-02-28",
    );
    expect(addMonthsUtc(start("2026-01-15T00:00:00Z"), 13).toISOString().slice(0, 10)).toBe(
      "2027-02-15",
    );
  });

  it("buildMonthlyRecurrenceRule ancla el día del mes de startDate", () => {
    expect(buildMonthlyRecurrenceRule(start("2026-08-15T00:00:00Z"))).toBe(
      "FREQ=MONTHLY;BYMONTHDAY=15",
    );
  });
});
