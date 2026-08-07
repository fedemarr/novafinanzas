import { describe, expect, it } from "vitest";
import { computeAccountBalance } from "../account-balance";

const usdArs = { baseCurrencyCode: "USD", quoteCurrencyCode: "ARS", rate: "1000" };

describe("computeAccountBalance", () => {
  it("devuelve el balance inicial sin transacciones", () => {
    const balance = computeAccountBalance({
      accountId: "acc-1",
      accountCurrency: "ARS",
      initialBalance: "1000",
      transactions: [],
    });
    expect(balance.amount.toString()).toBe("1000");
  });

  it("resta un gasto en la misma moneda de la cuenta", () => {
    const balance = computeAccountBalance({
      accountId: "acc-1",
      accountCurrency: "ARS",
      initialBalance: "1000",
      transactions: [
        {
          type: "EXPENSE",
          amount: "300",
          currency: "ARS",
          accountId: "acc-1",
          counterAccountId: null,
          fxRate: null,
        },
      ],
    });
    expect(balance.amount.toString()).toBe("700");
  });

  it("suma un ingreso en la misma moneda", () => {
    const balance = computeAccountBalance({
      accountId: "acc-1",
      accountCurrency: "ARS",
      initialBalance: "1000",
      transactions: [
        {
          type: "INCOME",
          amount: "500",
          currency: "ARS",
          accountId: "acc-1",
          counterAccountId: null,
          fxRate: null,
        },
      ],
    });
    expect(balance.amount.toString()).toBe("1500");
  });

  it("convierte un gasto en USD desde una cuenta en ARS usando el fxRate de la transacción (caso M1)", () => {
    const balance = computeAccountBalance({
      accountId: "acc-1",
      accountCurrency: "ARS",
      initialBalance: "100000",
      transactions: [
        {
          type: "EXPENSE",
          amount: "10", // 10 USD
          currency: "USD",
          accountId: "acc-1",
          counterAccountId: null,
          fxRate: usdArs, // 1 USD = 1000 ARS
        },
      ],
    });
    // 100000 - (10 * 1000) = 90000
    expect(balance.amount.toString()).toBe("90000");
    expect(balance.currency).toBe("ARS");
  });

  it("tira error si hay un monto en otra moneda sin fxRate", () => {
    expect(() =>
      computeAccountBalance({
        accountId: "acc-1",
        accountCurrency: "ARS",
        initialBalance: "1000",
        transactions: [
          {
            type: "EXPENSE",
            amount: "10",
            currency: "USD",
            accountId: "acc-1",
            counterAccountId: null,
            fxRate: null,
          },
        ],
      }),
    ).toThrow();
  });

  it("transferencia: resta del lado origen", () => {
    const balance = computeAccountBalance({
      accountId: "acc-origen",
      accountCurrency: "ARS",
      initialBalance: "1000",
      transactions: [
        {
          type: "TRANSFER",
          amount: "200",
          currency: "ARS",
          accountId: "acc-origen",
          counterAccountId: "acc-destino",
          fxRate: null,
        },
      ],
    });
    expect(balance.amount.toString()).toBe("800");
  });

  it("transferencia: suma del lado destino", () => {
    const balance = computeAccountBalance({
      accountId: "acc-destino",
      accountCurrency: "ARS",
      initialBalance: "1000",
      transactions: [
        {
          type: "TRANSFER",
          amount: "200",
          currency: "ARS",
          accountId: "acc-origen",
          counterAccountId: "acc-destino",
          fxRate: null,
        },
      ],
    });
    expect(balance.amount.toString()).toBe("1200");
  });
});
