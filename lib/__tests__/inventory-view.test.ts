// Casos de recipe_requirements, simulated_recipe_outputs y stock_alert (services/inventory_sources.py, routes/inventory.py).
import { describe, expect, it } from "vitest";
import { D } from "../costing/decimal";
import { recipeRequirements, simulateOutput } from "../inventory-view";

describe("demanda de la carta", () => {
  it("suma un lote de cada plato por insumo, con la merma", () => {
    const req = recipeRequirements([
      { dish: "Ceviche", lines: [{ materialId: 1, quantity: "180", factor: "0.001", mode: "loss", rate: "0.1" }] },
      { dish: "Tiradito", lines: [{ materialId: 1, quantity: "200", factor: "0.001", mode: "gross", rate: "0" }] },
    ]);
    expect(req.get("1")?.quantity.toFixed()).toBe("0.4");
    expect(req.get("1")?.dishes).toEqual(["Ceviche", "Tiradito"]);
  });
});

describe("salida simulada y alerta de stock bajo", () => {
  it("valora al promedio vigente y proyecta el saldo", () => {
    const s = simulateOutput({ quantity: new D(30), value: new D(2360) }, new D("4.5"));
    expect(s.cost?.toFixed()).toBe(new D(2360).div(30).times("4.5").toFixed());
    expect(s.projectedQuantity.toFixed()).toBe("25.5");
    expect(s.low).toBe(false);
  });

  it("alerta cuando la existencia alcanza o cae bajo un lote", () => {
    expect(simulateOutput({ quantity: new D(2), value: new D(10) }, new D(2)).low).toBe(true);
    const s = simulateOutput({ quantity: new D(1), value: new D(10) }, new D(3));
    expect(s.low).toBe(true);
    expect(s.missing.toFixed()).toBe("2");
    expect(s.cost).toBeNull();
    expect(s.projectedQuantity.toFixed()).toBe("-2");
  });

  it("sin kardex o con valoración pendiente no inventa costos", () => {
    expect(simulateOutput(null, new D(1)).cost).toBeNull();
    expect(simulateOutput({ quantity: new D(5), value: null }, new D(1)).cost).toBeNull();
  });
});
