// Casos de forms/product.py (QuantityForm) y consumption_options de routes/products.py.
import { describe, expect, it } from "vitest";
import { consumptionOptions, parseLine, ratePercent } from "../recipes";

const units = [
  { code: "g", name: "Gramo", symbol: "g", dimension: "mass", numerator: 1, denominator: 1 },
  { code: "kg", name: "Kilogramo", symbol: "kg", dimension: "mass", numerator: 1000, denominator: 1 },
  { code: "l", name: "Litro", symbol: "L", dimension: "volume", numerator: 1000, denominator: 1 },
  { code: "min", name: "Minuto", symbol: "min", dimension: "time", numerator: 1, denominator: 1 },
];

describe("línea de receta", () => {
  it("convierte el porcentaje en tasa exacta", () => {
    expect(parseLine({ quantity: "250", unitKey: "unit:g", mode: "loss", percent: "12,5" })).toEqual({
      value: { quantity: "250", unit_key: "unit:g", mode: "loss", rate: "0.125" },
    });
    expect(parseLine({ quantity: "1", unitKey: "custom:7", mode: "gross", percent: "" })).toEqual({
      value: { quantity: "1", unit_key: "custom:7", mode: "gross", rate: "0" },
    });
  });

  it.each([
    [{ quantity: "0", unitKey: "unit:g", mode: "gross", percent: "0" }, "quantity"],
    [{ quantity: "1", unitKey: "unit:g", mode: "loss", percent: "100" }, "percent"],
    [{ quantity: "1", unitKey: "unit:g", mode: "gross", percent: "5" }, "percent"],
    [{ quantity: "1", unitKey: "", mode: "gross", percent: "0" }, "unitKey"],
    [{ quantity: "1", unitKey: "unit:g", mode: "otro", percent: "0" }, "mode"],
  ])("rechaza %#", (input, field) => {
    const result = parseLine(input);
    expect("errors" in result && result.errors).toHaveProperty(field);
  });

  it("muestra la tasa como porcentaje", () => expect(ratePercent("0.125")).toBe("12.5"));
});

describe("unidades de consumo", () => {
  it("misma dimensión física y presentaciones del insumo", () => {
    const options = consumptionOptions(units[1], units, [{ id: 3, label: "Atado", factor: "0.250" }]);
    expect(options.map((o) => [o.key, o.factor])).toEqual([
      ["unit:g", "0.001"],
      ["unit:kg", "1"],
      ["custom:3", "0.25"],
    ]);
  });
});
