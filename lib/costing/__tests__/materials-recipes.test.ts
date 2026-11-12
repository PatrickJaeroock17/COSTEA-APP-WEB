// Port de los casos puros de test_materials.py, test_products.py, test_companies.py y test_excel_improvements.py.
import { describe, expect, it } from "vitest";
import { D, moneyText } from "../decimal";
import { type CostVersion, acquisitionCost, effectiveVersion, versionResult } from "../materials";
import { type LineInput, calculateLine, recipeTotals } from "../recipes";
import { convertQuantity } from "../units";
import { eq } from "./helpers";

describe("costo de adquisición", () => {
  it("excluye el IGV recuperable y conserva la precisión", () => {
    let result = acquisitionCost("2", "1000", "160", "4", "6", "28.8");
    eq(result.baseQuantity, "2000");
    eq(result.acquisitionAmount, "170");
    eq(result.unitCost, "0.085");
    eq(result.recoverableTax, "28.8");
    // 250 g a 80/kg = 20, sin redondeo intermedio a céntimos.
    result = acquisitionCost("1", "1000", "80", "0", "0", "0");
    eq(result.unitCost.times("250"), "20");
    // El motor trabaja siempre con 28 dígitos.
    result = acquisitionCost("3", "1", "1", "0", "0", "0");
    expect(result.unitCost.toString()).toBe("0.3333333333333333333333333333");
  });

  it.each([null, 1.25, "NaN", "Infinity", "-1"])("rechaza entradas inválidas: %s", (bad) => {
    expect(() => acquisitionCost("1", "1", bad as string, "0", "0", "0")).toThrow();
  });

  it("rechaza denominadores cero", () => {
    for (const [q, f] of [["0", "1"], ["1", "0"]]) expect(() => acquisitionCost(q, f, "1", "0", "0", "0")).toThrow();
  });

  it("historial de precios por fecha de vigencia", () => {
    const costs: CostVersion[] = [
      { id: 1, effectiveOn: "2026-09-01", mode: "purchase", quantity: "2", factor: "1000", netAmount: "160", nonrecoverableTax: "4", attributableCost: "6", recoverableTax: "28.8" },
      { id: 2, effectiveOn: "2026-09-01", mode: "direct", unitCost: "0.1" },
      { id: 3, effectiveOn: "2027-01-01", mode: "direct", unitCost: "999999999999.123456" },
      { id: 4, effectiveOn: "2026-10-01", mode: "direct", unitCost: "0" },
    ];
    expect(effectiveVersion(costs, "2026-08-31")).toBeNull();
    eq(versionResult(effectiveVersion(costs, "2026-09-15")!), "0.1");
    eq(versionResult(effectiveVersion(costs, "2026-12-31")!), "0");
    eq(versionResult(effectiveVersion(costs, "2027-01-01")!), "999999999999.123456");
    eq(versionResult(costs[0]), "0.085");
  });
});

describe("recetas", () => {
  it.each([
    ["gross", "0", "0.25", "20"],
    ["loss", "0.2", "0.3125", "25"],
    ["additional", "0.2", "0.30", "24"],
  ] as const)("aritmética de referencia: %s", (mode, rate, gross, amount) => {
    const result = calculateLine({ quantity: "250", factor: "0.001", unitCost: "80", mode, rate });
    eq(result.grossQuantity, gross);
    eq(result.amount, amount);
  });

  it("insumo neto utilizable con merma", () => {
    const net = calculateLine({ quantity: "250", factor: ".001", unitCost: "80", mode: "loss", rate: ".2" });
    eq(net.grossQuantity, ".3125");
    eq(net.amount, "25");
    eq(net.usableUnitCost, "100");
    eq(net.yieldRate, ".8");
    expect(() => calculateLine({ quantity: "250", factor: ".001", unitCost: "80", mode: "loss", rate: "1" })).toThrow();
  });

  it("lote, redondeo y receta vacía", () => {
    const [, total, perUnit] = recipeTotals([{ quantity: "3", factor: "1", unitCost: "40" }], "20");
    eq(total, "120");
    eq(perUnit, "6");
    eq(perUnit!.times(100), "600");
    expect(recipeTotals([], "1")).toEqual([[], null, null]);
    expect(moneyText("2.345")).toBe("2.35");
    expect(moneyText(null)).toBe("—");
    // No redondear cada línea antes de sumar.
    const line: LineInput = { quantity: "1", factor: "1", unitCost: "0.004" };
    const [, small] = recipeTotals([line, line, line], "1");
    eq(small, "0.012");
    expect(moneyText(small!)).toBe("0.01");
  });

  it.each<LineInput>([
    { quantity: "0", factor: "1", unitCost: "1" },
    { quantity: "1", factor: "0", unitCost: "1" },
    { quantity: "1", factor: "1", unitCost: "-1" },
    { quantity: "1", factor: "1", unitCost: "1", mode: "loss", rate: "1" },
    { quantity: "1", factor: "1", unitCost: "1", mode: "gross", rate: "0.2" },
    { quantity: "1", factor: "1", unitCost: "NaN" },
  ])("cálculo inválido de receta %#", (line) => {
    expect(() => calculateLine(line)).toThrow();
  });
});

describe("unidades", () => {
  const kg = { dimension: "mass", numerator: 1000, denominator: 1 };
  const g = { dimension: "mass", numerator: 1, denominator: 1 };
  const litre = { dimension: "volume", numerator: 1000, denominator: 1 };

  it("convierte con factores exactos y rechaza dimensiones distintas", () => {
    eq(convertQuantity(".25", kg, g), "250");
    eq(convertQuantity("250", g, kg), ".25");
    expect(() => convertQuantity("1", kg, litre)).toThrow();
    expect(() => convertQuantity(0.1 as unknown as string, kg, g)).toThrow();
    expect(new D("0.25").eq(convertQuantity("250", g, kg))).toBe(true);
  });
});
