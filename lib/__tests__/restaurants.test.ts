// Casos de legacy/Costea-main/costos_app/tests/test_companies.py que no dependen de la base de datos.
import { describe, expect, it } from "vitest";
import { parseMonthKey, periodKey, periodLabel, validateRestaurant } from "../restaurants";

const base = { legalName: "Cevichería El Puerto S.A.C.", tradeName: "", taxIdKind: "peru_ruc", taxId: "", currency: "PEN" };

describe("datos del restaurante", () => {
  it("acepta datos válidos y limpia espacios", () => {
    const { values, errors } = validateRestaurant({ ...base, legalName: "  El Puerto  ", taxId: "20123456789" });
    expect(errors).toEqual({});
    expect(values.legalName).toBe("El Puerto");
    expect(values.taxId).toBe("20123456789");
  });

  it.each([
    [{ legalName: "" }, "legalName"],
    [{ legalName: "A" }, "legalName"],
    [{ legalName: "x".repeat(181) }, "legalName"],
    [{ tradeName: "x".repeat(181) }, "tradeName"],
    [{ taxId: "123" }, "taxId"],
    [{ taxId: "2012345678A" }, "taxId"],
    [{ taxIdKind: "other", taxId: "RUC#1" }, "taxId"],
    [{ taxIdKind: "dni" }, "taxIdKind"],
    [{ currency: "BTC" }, "currency"],
  ])("rechaza datos inválidos %#", (change, field) => {
    expect(validateRestaurant({ ...base, ...change }).errors).toHaveProperty(field);
  });

  it("identificador opcional y otros formatos", () => {
    expect(validateRestaurant({ ...base, taxId: "" }).errors).toEqual({});
    expect(validateRestaurant({ ...base, taxIdKind: "other", taxId: "EIN 12-345/6.7_8" }).errors).toEqual({});
  });
});

describe("periodos", () => {
  it("lee AAAA-MM y valida rangos", () => {
    expect(parseMonthKey("2026-09")).toEqual({ year: 2026, month: 9 });
    for (const bad of ["2026-13", "2026-00", "1899-12", "26-09", "2026/09", ""]) {
      expect(parseMonthKey(bad)).toHaveProperty("error");
    }
  });

  it("etiqueta y clave", () => {
    expect(periodLabel(2026, 9)).toBe("Setiembre 2026");
    expect(periodKey(2026, 9)).toBe("2026-09");
  });
});
