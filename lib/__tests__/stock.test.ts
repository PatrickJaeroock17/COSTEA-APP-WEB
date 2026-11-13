import { describe, expect, it } from "vitest";
import { parseShortages, stockQty } from "../stock";

describe("faltantes de stock", () => {
  it("lee el detalle del error y ordena por faltante de mayor a menor", () => {
    const rows = parseShortages({
      hint: "stock",
      details: JSON.stringify([
        { name: "Ají limo", unit: "kg", needed: "0.3", available: "0.1" },
        { name: "Corvina Filete", unit: "kg", needed: "2.105263157894736842", available: "0" },
        { name: "Aceite", unit: "L", needed: "1", available: "0.5" },
      ]),
    });
    expect(rows?.map((r) => [r.name, r.missing])).toEqual([
      ["Corvina Filete", "2.105263157894736842"],
      ["Aceite", "0.5"],
      ["Ají limo", "0.2"],
    ]);
  });

  it("ignora errores que no son de stock", () => {
    expect(parseShortages({ hint: null, details: "[]" })).toBeNull();
    expect(parseShortages({ hint: "stock", details: "no es json" })).toBeNull();
    expect(parseShortages(null)).toBeNull();
  });

  it("muestra máximo 2 decimales con la unidad; el faltante se redondea hacia arriba", () => {
    expect(stockQty("2.105263157894736842", "kg")).toBe("2.11 kg");
    expect(stockQty("2.101", "kg", { ceil: true })).toBe("2.11 kg");
    expect(stockQty("1250", "g")).toBe("1,250 g");
    expect(stockQty("0", "L")).toBe("0 L");
  });
});
