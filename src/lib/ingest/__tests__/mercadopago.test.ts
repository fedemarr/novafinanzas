import { describe, expect, it } from "vitest";
import { parseAmountString, parseMercadoPago } from "../parsers/mercadopago";

describe("parseAmountString", () => {
  it("formato ARS: 12.500,00 → 12500.00", () => {
    expect(parseAmountString("12.500,00")).toBe("12500.00");
  });

  it("punto decimal: 12500.00 → 12500.00", () => {
    expect(parseAmountString("12500.00")).toBe("12500.00");
  });

  it("formato EN: 12,500.00 → 12500.00", () => {
    expect(parseAmountString("12,500.00")).toBe("12500.00");
  });

  it("no numérico → null (nunca inventar)", () => {
    expect(parseAmountString("desconocido")).toBeNull();
  });
});

const mpPurchaseEmail = {
  fromAddress: "no-reply@mercadopago.com.ar",
  subject: "Tu pago se realizó correctamente",
  textBody: [
    "Hola Juan,",
    "",
    "Tu pago se realizó correctamente.",
    "",
    "Monto: $ 12.500,00",
    "Comercio: Fulanito SRL",
    "Fecha: 07/08/2026",
    "Nº de operación: 12345678",
  ].join("\n"),
};

describe("parseMercadoPago", () => {
  it("parsea un pago de compra (EXPENSE, ARS) con monto, comercio y fecha", () => {
    const result = parseMercadoPago(mpPurchaseEmail);
    expect(result).not.toBeNull();
    expect(result?.parserKey).toBe("mercadopago");
    expect(result?.items).toHaveLength(1);
    const item = result!.items[0];
    expect(item.type).toBe("EXPENSE");
    expect(String(item.amount)).toBe("12500.00");
    expect(item.currencyCode).toBe("ARS");
    expect(item.occurredAt.toISOString().slice(0, 10)).toBe("2026-08-07");
    expect(item.merchantRaw).toBe("Fulanito SRL");
    expect(item.merchantNormalized).toBe("fulanito srl");
  });

  it("detecta pago recibido como INCOME", () => {
    const email = {
      ...mpPurchaseEmail,
      subject: "Recibiste un pago",
      textBody: [
        "Hola Juan,",
        "Recibiste un pago de $ 50.000,00.",
        "Fecha: 01/08/2026",
      ].join("\n"),
    };
    const result = parseMercadoPago(email);
    expect(result?.items[0].type).toBe("INCOME");
    expect(String(result!.items[0].amount)).toBe("50000.00");
  });

  it("no reconoce mails de otra institución", () => {
    const result = parseMercadoPago({
      fromAddress: "alertas@santander.com.ar",
      subject: "Movimiento",
      textBody: "Compraste por $ 1000.",
    });
    expect(result).toBeNull();
  });

  it("devuelve null si falta el monto o la fecha (nunca inventar)", () => {
    const noAmount = parseMercadoPago({ ...mpPurchaseEmail, textBody: "Sin monto." });
    expect(noAmount).toBeNull();
    const noDate = parseMercadoPago({
      ...mpPurchaseEmail,
      textBody: "Monto: $ 12.500,00\nComercio: Fulanito",
    });
    expect(noDate).toBeNull();
  });
});
