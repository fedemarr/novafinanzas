import { describe, expect, it } from "vitest";
import { computeDedupeHash } from "../dedupe-hash";

const base = {
  userId: "user-1",
  accountId: "acc-1",
  amount: "100",
  currency: "ARS",
  occurredAt: new Date("2026-08-05T14:30:00Z"),
  merchantKey: "Supermercado XYZ",
};

describe("computeDedupeHash", () => {
  it("es determinístico para el mismo input", () => {
    expect(computeDedupeHash(base)).toBe(computeDedupeHash(base));
  });

  it("es insensible a mayúsculas/espacios en el merchant", () => {
    const a = computeDedupeHash(base);
    const b = computeDedupeHash({ ...base, merchantKey: "  supermercado xyz  " });
    expect(a).toBe(b);
  });

  it("ignora la hora — solo importa el día", () => {
    const a = computeDedupeHash(base);
    const b = computeDedupeHash({ ...base, occurredAt: new Date("2026-08-05T23:59:00Z") });
    expect(a).toBe(b);
  });

  it("cambia si cambia el día", () => {
    const a = computeDedupeHash(base);
    const b = computeDedupeHash({ ...base, occurredAt: new Date("2026-08-06T14:30:00Z") });
    expect(a).not.toBe(b);
  });

  it("cambia si cambia el monto, la cuenta o la moneda", () => {
    const a = computeDedupeHash(base);
    expect(computeDedupeHash({ ...base, amount: "101" })).not.toBe(a);
    expect(computeDedupeHash({ ...base, accountId: "acc-2" })).not.toBe(a);
    expect(computeDedupeHash({ ...base, currency: "USD" })).not.toBe(a);
  });
});
