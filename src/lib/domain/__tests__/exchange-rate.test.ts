import { describe, expect, it } from "vitest";
import { money } from "../money";
import { convertMoney } from "../exchange-rate";

const usdArs = { baseCurrencyCode: "USD", quoteCurrencyCode: "ARS", rate: "1000" };

describe("convertMoney", () => {
  it("no hace nada si ya está en la moneda destino", () => {
    const result = convertMoney(money("50", "ARS"), "ARS", usdArs);
    expect(result.amount.toString()).toBe("50");
    expect(result.currency).toBe("ARS");
  });

  it("convierte en la dirección base → quote multiplicando", () => {
    const result = convertMoney(money("10", "USD"), "ARS", usdArs);
    expect(result.amount.toString()).toBe("10000");
    expect(result.currency).toBe("ARS");
  });

  it("convierte en la dirección quote → base dividiendo", () => {
    const result = convertMoney(money("5000", "ARS"), "USD", usdArs);
    expect(result.amount.toString()).toBe("5");
    expect(result.currency).toBe("USD");
  });

  it("tira error si el par no sirve para la conversión pedida", () => {
    expect(() => convertMoney(money("10", "BTC"), "EUR", usdArs)).toThrow();
  });

  it("mantiene precisión decimal sin errores de punto flotante", () => {
    const rate = { baseCurrencyCode: "USD", quoteCurrencyCode: "ARS", rate: "1234.5678901234" };
    const result = convertMoney(money("0.1", "USD"), "ARS", rate);
    expect(result.amount.toString()).toBe("123.45678901234");
  });
});
