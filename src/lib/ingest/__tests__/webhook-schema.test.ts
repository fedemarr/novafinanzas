import { describe, expect, it } from "vitest";
import { extractEmailAddress } from "../webhook-schema";

describe("extractEmailAddress", () => {
  it("extrae el mail de un header con nombre", () => {
    expect(extractEmailAddress("Juan Pérez <juan@x.com>")).toBe("juan@x.com");
  });

  it("devuelve el mail pelado tal cual (lowercase)", () => {
    expect(extractEmailAddress("JUAN@X.com")).toBe("juan@x.com");
  });

  it("sin mail: devuelve el string limpio", () => {
    expect(extractEmailAddress("  juan@x.com  ")).toBe("juan@x.com");
  });
});
