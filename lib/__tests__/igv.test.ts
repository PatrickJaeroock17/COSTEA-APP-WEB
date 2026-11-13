// IGV configurable: validación de la tasa, precio del ceviche del Excel UNI al 10 % frente a un restaurante
// al 18 %, y ventas que conservan la tasa con la que se registraron.
import { describe, expect, it } from "vitest";
import { price } from "../costing/costing";
import { summarize } from "../costing/sales";
import { igvChoice, igvLabel, parseIgvRate } from "../restaurants";

describe("tasa de IGV del restaurante", () => {
  it("opciones fijas y otra tasa entre 0 y 30 %", () => {
    expect(parseIgvRate("18", "")).toEqual({ rate: "0.18" });
    expect(parseIgvRate("10.5", "")).toEqual({ rate: "0.105" });
    expect(parseIgvRate("10", "")).toEqual({ rate: "0.1" });
    expect(parseIgvRate("other", "12,25")).toEqual({ rate: "0.1225" });
    expect(parseIgvRate("other", "0")).toEqual({ rate: "0" });
    expect(parseIgvRate("other", "30")).toEqual({ rate: "0.3" });
    for (const bad of ["30.01", "45", "-1", "abc", "", "12.12345"]) expect(parseIgvRate("other", bad)).toHaveProperty("error");
  });

  it("muestra la tasa guardada y la vuelve a elegir en el formulario", () => {
    expect(igvLabel("0.180000")).toBe("18 %");
    expect(igvLabel("0.105000")).toBe("10.5 %");
    expect(igvChoice("0.180000")).toEqual({ choice: "18", other: "" });
    expect(igvChoice("0.100000")).toEqual({ choice: "10", other: "" });
    expect(igvChoice("0.122500")).toEqual({ choice: "other", other: "12.25" });
  });
});

describe("precio con la tasa del restaurante", () => {
  // Hoja2 G49 (costo total del ceviche) y G53 (precio de venta con impuesto al 10 %).
  const cost = "32.77392565372611";
  it("ceviche del Excel UNI al 10 %: valor de venta 41.02 e impuesto 4.10 (G51, G52)", () => {
    const p = price(cost, "manual", "45.12631821909872", "0.1");
    expect(p.final.toFixed()).toBe("45.13");
    expect(p.net.minus("41.02392565372611").abs().lte("0.01")).toBe(true);
    expect(p.tax.minus("4.102392565372611").abs().lte("0.01")).toBe(true);
  });

  it("el mismo precio en un restaurante al 18 % deja menos venta neta", () => {
    const p = price(cost, "manual", "45.12631821909872", "0.18");
    expect(p.net.toDecimalPlaces(4).toFixed()).toBe("38.2458");
    expect(p.tax.toDecimalPlaces(4).toFixed()).toBe("6.8842");
  });
});

describe("ventas con su tasa congelada", () => {
  it("una venta antigua al 18 % no cambia cuando el restaurante pasa al 10 %", () => {
    const sale = (id: number, rate: string) => ({ productId: id, productName: `Plato ${id}`, quantity: "10", unitPrice: "118", unitCost: "40", taxRate: rate });
    const before = summarize([sale(1, "0.18")], "0", "0", "0.18");
    const after = summarize([sale(1, "0.18"), sale(2, "0.10")], "300", "0", "0.10");
    expect(before.net.toFixed()).toBe("1000");
    // La venta antigua sigue aportando 1000 netos; la nueva, 1180 / 1.10.
    expect(after.rows.find((r) => r.name === "Plato 1")!.net.toFixed()).toBe("1000");
    expect(after.rows.find((r) => r.name === "Plato 2")!.net.toDecimalPlaces(4).toFixed()).toBe("1072.7273");
    expect(after.tax.toDecimalPlaces(4).toFixed()).toBe("287.2727");
    // El punto de equilibrio con IGV usa la tasa actual del restaurante.
    expect(after.equilibriumGross!.minus(after.equilibrium!.times("1.10")).abs().lte("0.0000001")).toBe(true);
  });
});
