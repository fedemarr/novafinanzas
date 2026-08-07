import { describe, expect, it } from "vitest";
import { itemDedupeHash, itemToMoney, normalizeMerchant, type ParsedItem } from "../ingest";
import { money } from "../money";

const item = (overrides: Partial<ParsedItem> = {}): ParsedItem => ({
  type: "EXPENSE",
  amount: "12500.00",
  currencyCode: "ARS",
  occurredAt: new Date("2026-08-07T12:00:00Z"),
  merchantRaw: "Fulanito SRL",
  merchantNormalized: "fulanito srl",
  description: "Fulanito SRL",
  ...overrides,
});

describe("normalizeMerchant", () => {
  it("minúsculas y espacios colapsados", () => {
    expect(normalizeMerchant("  FULANITO   SRL ")).toBe("fulanito srl");
  });

  it("null y vacío → null", () => {
    expect(normalizeMerchant(null)).toBeNull();
    expect(normalizeMerchant("   ")).toBeNull();
  });
});

describe("itemToMoney", () => {
  it("arma el par (amount, currency) sin float", () => {
    const result = itemToMoney(item({ amount: "1250,50", currencyCode: "ARS" }));
    expect(result.amount.toString()).toBe("1250.5");
    expect(result.currency).toBe("ARS");
  });

  it("rechaza monto cero o negativo — nunca inventar", () => {
    expect(() => itemToMoney(item({ amount: "0" }))).toThrow(/mayor a cero/);
    expect(() => itemToMoney(item({ amount: "-10" }))).toThrow();
  });

  it("rechaza monto no numérico", () => {
    expect(() => itemToMoney(item({ amount: "n/a" }))).toThrow();
  });

  it("rechaza moneda vacía", () => {
    expect(() => itemToMoney(item({ currencyCode: "  " }))).toThrow(/moneda/);
  });
});

describe("itemDedupeHash", () => {
  it("es determinístico y usa merchantNormalized como merchantKey", () => {
    const ctx = { userId: "u1", accountId: "a1" };
    const a = itemDedupeHash(item(), ctx);
    const b = itemDedupeHash(item(), ctx);
    expect(a).toBe(b);
  });

  it("cambia si cambia el monto o la fecha", () => {
    const ctx = { userId: "u1", accountId: "a1" };
    const base = itemDedupeHash(item(), ctx);
    expect(itemDedupeHash(item({ amount: "12501.00" }), ctx)).not.toBe(base);
    expect(
      itemDedupeHash(item({ occurredAt: new Date("2026-08-08T12:00:00Z") }), ctx),
    ).not.toBe(base);
  });

  it("cae a merchantRaw / description si falta normalized", () => {
    const ctx = { userId: "u1", accountId: "a1" };
    const raw = itemDedupeHash(item({ merchantNormalized: null }), ctx);
    expect(raw).not.toBeNull();
    expect(raw.length).toBe(64);
  });
});

describe("ingreso vs gasto mantienen la moneda del par", () => {
  it("un ingreso en USD conserva USD", () => {
    const result = itemToMoney(item({ type: "INCOME", currencyCode: "USD" }));
    expect(result).toEqual(money("12500", "USD"));
  });
});
