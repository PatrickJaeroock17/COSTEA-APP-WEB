// Casos de forms/material.py y purchase_options de routes/materials.py.
import { describe, expect, it } from "vitest";
import { parseAmount, parseDate, periodDates, purchaseOptions, validateConversionLabel, validateMaterial } from "../materials";

const units = [
  { code: "g", name: "Gramo", symbol: "g", dimension: "mass", numerator: 1, denominator: 1 },
  { code: "kg", name: "Kilogramo", symbol: "kg", dimension: "mass", numerator: 1000, denominator: 1 },
  { code: "l", name: "Litro", symbol: "L", dimension: "volume", numerator: 1000, denominator: 1 },
];

describe("importes exactos", () => {
  it.each([
    ["12", "12"],
    ["12,5", "12.5"],
    ["0.000001", "0.000001"],
    ["999999999999.123456", "999999999999.123456"],
  ])("acepta %s", (raw, value) => expect(parseAmount(raw)).toEqual({ value }));

  it.each(["", "-1", "1.234.5", "1,000.50", "1e3", "0.1234567", "1234567890123"])("rechaza %s", (raw) => {
    expect(parseAmount(raw)).toHaveProperty("error");
  });

  it("positivo cuando se exige", () => {
    expect(parseAmount("0", { positive: true })).toHaveProperty("error");
    expect(parseAmount("0.0", { positive: true })).toHaveProperty("error");
  });
});

describe("fechas", () => {
  it("valida fechas reales", () => {
    expect(parseDate("2026-02-28")).toBe("2026-02-28");
    expect(parseDate("2026-02-30")).toBeNull();
    expect(parseDate("28/02/2026")).toBeNull();
  });

  it("referencia al fin del mes de trabajo; registro con hoy si cae en el mes", () => {
    expect(periodDates({ year: 2026, month: 2 }, "2026-11-12")).toEqual({ reference: "2026-02-28", defaultEntry: "2026-02-28" });
    expect(periodDates({ year: 2026, month: 11 }, "2026-11-12")).toEqual({ reference: "2026-11-30", defaultEntry: "2026-11-12" });
  });
});

describe("datos del insumo", () => {
  it("código AAA-000 solo para propios", () => {
    const base = { name: "Limón", variety: "Sutil", category: "Frutas", supplier: "" };
    expect(validateMaterial({ ...base, code: "fru-001" }, { codeEditable: true }).errors).toEqual({});
    expect(validateMaterial({ ...base, code: "FRU-01" }, { codeEditable: true }).errors).toHaveProperty("code");
    expect(validateMaterial({ ...base, code: "" }, { codeEditable: false }).errors).toEqual({});
    expect(validateMaterial({ ...base, name: "" }, { codeEditable: false }).errors).toHaveProperty("name");
  });
});

describe("presentaciones y unidades de compra", () => {
  it("no redefine unidades universales ni repite nombres", () => {
    expect(validateConversionLabel("kg", units, [])).toMatch(/específico/);
    expect(validateConversionLabel("Kilogramo", units, [])).toMatch(/específico/);
    expect(validateConversionLabel("bolsa 5 kg", units, ["Bolsa 5 kg"])).toMatch(/Ya existe/);
    expect(validateConversionLabel("Atado", units, [])).toBeNull();
  });

  it("ofrece unidades de la misma dimensión y presentaciones propias", () => {
    const options = purchaseOptions(units[1], units, [{ id: 7, label: "Atado", factor: "0.250", evidence: "Pesado en cocina" }]);
    expect(options.map((o) => [o.key, o.factor])).toEqual([
      ["unit:kg", "1"],
      ["unit:g", "0.001"],
      ["custom:7", "0.25"],
    ]);
  });
});
