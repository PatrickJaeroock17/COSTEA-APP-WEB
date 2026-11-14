import { describe, expect, it } from "vitest";
import { calculatePlan } from "@/lib/costing/costing";
import { D } from "@/lib/costing/decimal";
import { scenario } from "@/lib/costing/__tests__/helpers";
import type { BudgetSnapshot } from "@/lib/data/budgets";
import { budgetProgress, buildReportCharts } from "@/lib/report-charts";

const actual = {
  net: new D("6000"),
  materials: new D("2400"),
  equilibrium: new D("5000"),
  equilibriumGross: new D("5900"),
  ratio: new D("0.6"),
  rows: [{ name: "Ceviche", quantity: new D("200") }],
};

describe("datos de los gráficos de Reportes (caso GUIA_RAPIDA)", () => {
  const result = calculatePlan(scenario());
  const data = buildReportCharts(result, actual, null, null, "PEN");

  it("la composición suma los costos del periodo", () => {
    const parts = Object.fromEntries(data.composition.parts.map((p) => [p.key, p.value]));
    expect(parts).toEqual({ mp: "4800", mo: "2000", cif: "800", gastos: "400", idle: "400" });
    const total = data.composition.parts.reduce((a, p) => a.plus(p.value), new D(0));
    expect(total.eq(data.composition.total)).toBe(true);
    expect(data.composition.total).toBe("8400");
  });

  it("las capas por porción suman el costo completo del motor", () => {
    for (const [i, row] of data.costPerPortion.entries()) {
      const stacked = new D(row.mp).plus(row.mo).plus(row.cif).plus(row.gastos);
      expect(stacked.eq(row.complete), row.name).toBe(true);
      expect(row.complete).toBe(result.rows[i].complete!.toFixed());
    }
    expect(data.costPerPortion[0].complete).toBe("10");
  });

  it("márgenes, punto de equilibrio y capacidad salen tal cual del motor", () => {
    expect(data.margins.map((m) => m.margin)).toEqual(result.rows.filter((r) => r.price).map((r) => r.price!.margin!.toFixed()));
    expect(data.breakeven.equilibrium).toBe("5000");
    expect(data.capacity.idle).toBe("400");
    expect(data.budget).toBeNull();
  });

  it("avance de porciones frente al presupuesto publicado", () => {
    const snap = { result: { rows: [{ id: 1, name: "Ceviche", quantity: "800" }, { id: 2, name: "Leche", quantity: "0" }], totals: { sales: "12000", cmp: "4800" } } } as unknown as BudgetSnapshot;
    const progress = budgetProgress(snap, actual);
    expect(progress[0].progress!.toFixed()).toBe("0.25");
    expect(progress[1].progress).toBeNull();
    const withBudget = buildReportCharts(result, actual, snap, 3, "PEN");
    expect(withBudget.budget!.version).toBe(3);
    expect(withBudget.budget!.totals).toEqual([
      { concept: "Ventas netas", budget: "12000", actual: "6000" },
      { concept: "Materia prima", budget: "4800", actual: "2400" },
    ]);
  });
});
