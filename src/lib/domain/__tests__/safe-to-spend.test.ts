import { describe, expect, it } from "vitest";
import { money } from "../money";
import {
  computeSafeToSpend,
  paydayInfo,
  prorateGoalContribution,
} from "../safe-to-spend";

const ars = (amount: string) => money(amount, "ARS");

describe("paydayInfo", () => {
  it("cobro el 1, hoy 7 de agosto → próximo 1 de septiembre, 25 días", () => {
    const info = paydayInfo(1, new Date("2026-08-07T00:00:00Z"));
    expect(info.nextPayday.toISOString().slice(0, 10)).toBe("2026-09-01");
    expect(info.daysUntilPayday).toBe(25);
    expect(info.lastPayday.toISOString().slice(0, 10)).toBe("2026-08-01");
    expect(info.cycleDays).toBe(31);
  });

  it("cobro el 15, hoy 7 de agosto → próximo 15 de agosto, 8 días", () => {
    const info = paydayInfo(15, new Date("2026-08-07T00:00:00Z"));
    expect(info.nextPayday.toISOString().slice(0, 10)).toBe("2026-08-15");
    expect(info.daysUntilPayday).toBe(8);
    expect(info.lastPayday.toISOString().slice(0, 10)).toBe("2026-07-15");
    expect(info.cycleDays).toBe(31);
  });

  it("si hoy ES el día de cobro, el próximo es el mes que viene", () => {
    const info = paydayInfo(7, new Date("2026-08-07T00:00:00Z"));
    expect(info.nextPayday.toISOString().slice(0, 10)).toBe("2026-09-07");
    expect(info.daysUntilPayday).toBe(31);
    expect(info.lastPayday.toISOString().slice(0, 10)).toBe("2026-08-07");
    expect(info.cycleDays).toBe(31);
  });

  it("satura fin de mes: cobro el 31 en febrero → 28", () => {
    const info = paydayInfo(31, new Date("2026-02-10T00:00:00Z"));
    expect(info.nextPayday.toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("cruce de año: cobro el 31, hoy 28 de diciembre → próximo 31 de enero", () => {
    const info = paydayInfo(31, new Date("2026-12-28T00:00:00Z"));
    expect(info.nextPayday.toISOString().slice(0, 10)).toBe("2026-12-31");
    const after = paydayInfo(31, new Date("2026-12-31T00:00:00Z"));
    expect(after.nextPayday.toISOString().slice(0, 10)).toBe("2027-01-31");
  });

  it("rechaza día de cobro inválido", () => {
    expect(() => paydayInfo(0, new Date())).toThrow(/1 y 31/);
    expect(() => paydayInfo(32, new Date())).toThrow(/1 y 31/);
  });
});

describe("computeSafeToSpend", () => {
  it("calculo base del doc: disponible + ingresos - comprometido - aporte", () => {
    const result = computeSafeToSpend({
      available: ars("1000000"),
      incomeBeforePayday: ars("300000"),
      committedBeforePayday: ars("400000"),
      goalContributionForCycle: ars("100000"),
      daysUntilPayday: 25,
    });
    expect(result.total.amount.toString()).toBe("800000");
    expect(result.daily.amount.toString()).toBe("32000");
    expect(result.isDeficit).toBe(false);
    expect(result.daily.currency).toBe("ARS");
  });

  it("sin ingreso recurrente cargado: disponibles - comprometido - aporte", () => {
    const result = computeSafeToSpend({
      available: ars("500000"),
      incomeBeforePayday: ars("0"),
      committedBeforePayday: ars("200000"),
      goalContributionForCycle: ars("0"),
      daysUntilPayday: 30,
    });
    expect(result.total.amount.toString()).toBe("300000");
    expect(result.daily.amount.toString()).toBe("10000");
  });

  it("deficit: no se clampa a cero, se marca isDeficit y el diario es negativo", () => {
    const result = computeSafeToSpend({
      available: ars("100000"),
      incomeBeforePayday: ars("0"),
      committedBeforePayday: ars("250000"),
      goalContributionForCycle: ars("0"),
      daysUntilPayday: 25,
    });
    expect(result.isDeficit).toBe(true);
    expect(result.total.amount.toString()).toBe("-150000");
    expect(result.daily.amount.toString()).toBe("-6000");
  });

  it("tira error si los montos no están en la misma moneda", () => {
    expect(() =>
      computeSafeToSpend({
        available: ars("100"),
        incomeBeforePayday: money("50", "USD"),
        committedBeforePayday: ars("0"),
        goalContributionForCycle: ars("0"),
        daysUntilPayday: 5,
      }),
    ).toThrow();
  });

  it("tira error si no quedan días hasta el cobro", () => {
    expect(() =>
      computeSafeToSpend({
        available: ars("100"),
        incomeBeforePayday: ars("0"),
        committedBeforePayday: ars("0"),
        goalContributionForCycle: ars("0"),
        daysUntilPayday: 0,
      }),
    ).toThrow(/1 día/);
  });
});

describe("prorateGoalContribution", () => {
  it("aporte 30000, ciclo 31 días, quedan 25 → 24193.55", () => {
    const prorated = prorateGoalContribution(ars("30000"), 25, 31, 2);
    expect(prorated.amount.toString()).toBe("24193.55");
  });

  it("el prorrateo descuenta lo mismo por día sin importar el día del ciclo", () => {
    // día 1 del ciclo: quedan 31 → aporte = 30000 (31/31)
    const early = prorateGoalContribution(ars("30000"), 31, 31, 2);
    // día 25: quedan 7 → aporte = 30000*7/31 = 6774.19
    const late = prorateGoalContribution(ars("30000"), 7, 31, 2);
    expect(early.amount.toString()).toBe("30000");
    expect(late.amount.toString()).toBe("6774.19");
    // el diario (aporte/días) coincide a centavos en ambos casos — el
    // redondeo del aporte a 2 decimales introduce un desvío sub-centavo
    expect(early.amount.dividedBy(31).toDecimalPlaces(2).toString()).toBe(
      late.amount.dividedBy(7).toDecimalPlaces(2).toString(),
    );
  });

  it("mantiene la moneda del aporte", () => {
    const prorated = prorateGoalContribution(money("100", "USD"), 10, 30, 2);
    expect(prorated.currency).toBe("USD");
  });
});
