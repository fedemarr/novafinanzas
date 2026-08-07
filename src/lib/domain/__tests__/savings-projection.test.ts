import { describe, expect, it } from "vitest";
import { averageMonthlySavings, projectSavings } from "../savings-projection";
import { money } from "../money";

describe("averageMonthlySavings", () => {
  it("devuelve null sin histórico", () => {
    expect(averageMonthlySavings([])).toBeNull();
  });

  it("devuelve el mismo monto con un solo mes", () => {
    const avg = averageMonthlySavings([money("5000", "ARS")]);
    expect(avg).not.toBeNull();
    expect(avg!.amount.toString()).toBe("5000");
    expect(avg!.currency).toBe("ARS");
  });

  it("promedia varios meses", () => {
    const avg = averageMonthlySavings([money("1000", "ARS"), money("1500", "ARS"), money("2000", "ARS")]);
    expect(avg!.amount.toString()).toBe("1500");
  });

  it("no pierde decimales", () => {
    const avg = averageMonthlySavings([money("1000", "ARS"), money("1001", "ARS")]);
    expect(avg!.amount.toString()).toBe("1000.5");
  });

  it("rechaza mezclar monedas", () => {
    expect(() =>
      averageMonthlySavings([money("1000", "ARS"), money("10", "USD")]),
    ).toThrow(/convertir primero/);
  });
});

describe("projectSavings", () => {
  it("devuelve [] sin histórico", () => {
    expect(projectSavings([], 6)).toEqual([]);
  });

  it("acumula el promedio mes a mes", () => {
    const result = projectSavings([money("1000", "ARS"), money("2000", "ARS")], 3);
    expect(result).toHaveLength(3);
    expect(result[0].expected.amount.toString()).toBe("1500");
    expect(result[0].cumulative.amount.toString()).toBe("1500");
    expect(result[1].cumulative.amount.toString()).toBe("3000");
    expect(result[2].cumulative.amount.toString()).toBe("4500");
    expect(result[2].expected.currency).toBe("ARS");
  });

  it("los offsets arrancan en 1", () => {
    const result = projectSavings([money("100", "USD")], 2);
    expect(result.map((m) => m.offset)).toEqual([1, 2]);
  });

  it("rechaza meses menores a 1", () => {
    expect(() => projectSavings([money("100", "ARS")], 0)).toThrow(/mayor o igual a 1/);
  });
});
