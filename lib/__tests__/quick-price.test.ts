import { describe, expect, it } from "vitest";
import { price } from "@/lib/costing/costing";
import { parseFoodCostTarget, quickPrice } from "@/lib/quick-price";

describe("precio sugerido del costo rápido (solo insumos)", () => {
  it("costo 9 con food cost 30 % e IGV 18 %: precio neto 30.00 y de carta 35.40", () => {
    const q = quickPrice("9", "30", "0.18");
    expect(q.net.toFixed(2)).toBe("30.00");
    expect(q.gross.toFixed(2)).toBe("35.40");
  });

  it("da el mismo resultado que el motor (modalidad food_cost)", () => {
    const q = quickPrice("12.345", "35", "0.18");
    expect(q.gross.toFixed(2)).toBe(price("12.345", "food_cost", "0.35", "0.18").final.toFixed(2));
  });

  it("respeta la tasa de IGV del restaurante", () => {
    expect(quickPrice("9", "30", "0.10").gross.toFixed(2)).toBe("33.00");
    expect(quickPrice("9", "30", "0").gross.toFixed(2)).toBe("30.00");
  });

  it("food cost del precio de carta actual: 35.40 con costo 9 = 30 %", () => {
    expect(quickPrice("9", "30", "0.18", "35.40").currentRatio?.times(100).toFixed(1)).toBe("30.0");
    expect(quickPrice("9", "30", "0.18", null).currentRatio).toBeNull();
  });

  it("valida el porcentaje con mensajes claros", () => {
    expect(parseFoodCostTarget("30")).toEqual({ value: "30" });
    expect(parseFoodCostTarget("28,5 %")).toEqual({ value: "28.5" });
    for (const bad of ["", "abc", "0", "100", "-5"]) expect("error" in parseFoodCostTarget(bad)).toBe(true);
  });
});
