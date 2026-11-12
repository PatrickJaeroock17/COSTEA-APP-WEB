// Port de test_portion_summary.py, test_production_table.py, test_overhead_tables.py, test_sales.py
// y test_inventory.py (la parte de cálculo; las rutas y la base de datos se prueban en sus módulos).
import { describe, expect, it } from "vitest";
import { calculatePlan } from "../costing";
import { D } from "../decimal";
import { type Movement, inventoryPrice, ledger, recipeQuantities, stockShortages } from "../inventory";
import { overheadTables, portionSummary, productionTable } from "../reports";
import { type SaleInput, summarize } from "../sales";
import { clone, employee, eq, near, scenario } from "./helpers";

describe("resumen de una porción", () => {
  it("divide solo las asignaciones mensuales, no los costos unitarios", () => {
    const result = calculatePlan(scenario()); // la receta rinde 20; el plan vende 800 al mes
    const summary = portionSummary(result, 1, ".18");
    const components = Object.fromEntries(summary.components.map(([k, v]) => [k, v!.toFixed()]));
    expect(components).toEqual({
      "Materia prima": "6",
      "Mano de obra directa": "2.5",
      CIF: "1",
      "Gastos administrativos": "0.5",
      "Gastos de ventas": "0",
      "Gastos financieros": "0",
      "Otros gastos": "0",
    });
    eq(summary.total, "10");
    eq(summary.profit, "5");
    eq(summary.net, "15");
    eq(summary.tax, "2.7");
    eq(summary.final, "17.7");
    eq(summary.suggested, "17.7");
    eq(summary.components.reduce((a, [, v]) => a.plus(v!), new D(0)), summary.total!.toFixed());
  });

  it("entradas faltantes bloquean el resumen final y cantidad cero es segura", () => {
    const data = scenario();
    data.staff = [];
    const summary = portionSummary(calculatePlan(data), 1, ".18");
    expect(summary.complete).toBe(false);
    for (const key of ["total", "profit", "net", "tax", "final"] as const) expect(summary[key]).toBeNull();
    data.lines[0].quantity = "0";
    expect(portionSummary(calculatePlan(data), 1, ".18").total).toBeNull();
  });
});

describe("tabla de producción", () => {
  it("filas separadas y totales mensuales que concilian", () => {
    const data = scenario();
    const second = clone(data.lines[0]);
    Object.assign(second, { id: 2, productId: 2, name: "Segundo plato", quantity: "100" });
    data.lines.push(second);
    const result = calculatePlan(data);
    const table = productionTable(result);
    expect(table.rows).toHaveLength(2);
    eq(table.quantity, "900");
    eq(table.sales, "13500");
    eq(table.rows.reduce((a, r) => a.plus(r.salesShare!), new D(0)), "1");
    eq(table.rows.reduce((a, r) => a.plus(r.share!), new D(0)), "1");
    eq(table.cost, result.totals.completeAssigned.toFixed());
    eq(table.cost!.plus(table.idle).plus(table.unassigned), result.totals.costs.toFixed());
  });
});

describe("tablas de CIF y gastos", () => {
  it("personal indirecto una sola vez y conceptos inactivos", () => {
    const data = scenario();
    data.staff = [employee(".5")];
    data.concepts = [{ ...data.concepts[0], id: "concept-1" }];
    data.noExpenses = true;
    const result = calculatePlan(data);
    const records = [
      { id: 1, name: "CIF", kind: "cif" as const, amount: "800", active: true, basis: "equivalent" },
      { id: 2, name: "Gastos", kind: "admin" as const, amount: "400", active: false, basis: "equivalent" },
    ];
    const groups = overheadTables(records, result, { id: 1, quantity: "800" });
    eq(groups[0].total, "2.5"); // 800 del concepto + 1200 de planilla / 800 porciones
    expect(groups[0].rows.filter((r) => r.payroll)).toHaveLength(1);
    eq(groups[1].total, "0");
    eq(groups[1].monthly, "0");
    expect(overheadTables(records)[0].total).toBeNull();
  });

  it("el reparto por ventas usa el porcentaje sin redondear", () => {
    const allocations = [
      {
        id: "concept-1",
        kind: "cif" as const,
        bases: new Map([[1, new D("18720")], [2, new D("244450")]]),
        exact: new Map([[1, new D("8000").times("18720").div("263170")]]),
        amount: new D("8000"),
      },
    ];
    const concept = { id: 1, name: "CIF", kind: "cif" as const, amount: "8000", active: true, basis: "sales" };
    const row = overheadTables([concept], { allocations }, { id: 1, quantity: "468" })[0].rows[0];
    eq(row.percent, new D("18720").div("263170").toFixed());
    near(row.unitCost, "1.2159440665729377", "1e-15");
  });
});

describe("ventas reales del mes", () => {
  const sample = (quantity = "10", price = "118", cost = "40", productId = 1): SaleInput => ({
    productId,
    productName: `Plato ${productId}`,
    quantity,
    unitPrice: price,
    unitCost: cost,
  });

  it("punto de equilibrio e IGV", () => {
    const r = summarize([sample()], "300", "100");
    eq(r.gross, "1180");
    eq(r.net, "1000");
    eq(r.tax, "180");
    eq(r.costs, "800");
    eq(r.profit, "200");
    eq(r.ratio, "0.5");
    eq(r.equilibrium, "600");
    eq(r.equilibriumGross, "708");
    eq(r.rows[0].profit, "200");
  });

  it("sin ventas, pérdida y fijos en cero", () => {
    const empty = summarize([], "100");
    expect(empty.equilibrium).toBeNull();
    eq(empty.profit, "-100");
    expect(summarize([sample("10", "118", "100")]).equilibrium).toBeNull();
    expect(summarize([sample("10", "118", "110")]).equilibrium).toBeNull();
    eq(summarize([sample()]).equilibrium, "0");
    const r = summarize([sample(), sample("20", "118", "40", 2)], "500", "100");
    expect(r.rows[0].name).toBe("Plato 2");
    near(r.rows.reduce((a, row) => a.plus(row.profit), new D(0)), r.profit.toFixed(), "0.00000001");
  });
});

describe("kardex con promedio ponderado", () => {
  const mov = (id: number, movementOn: string, kind: "in" | "out", quantity: string, unitCost = "0"): Movement => ({
    id,
    materialId: 1,
    movementOn,
    kind,
    quantity,
    unitCost,
  });
  // Receta: 250 g por plato (factor 0,001 → kg), rinde 1 plato.
  const recipe = { outputQuantity: "1", lines: [{ materialId: 1, quantity: "250", factor: "0.001", mode: "gross" as const, rate: "0" }] };

  it("promedio ponderado, venta y anulación", () => {
    const moves = [mov(1, "2026-09-01", "in", "10", "80"), mov(2, "2026-09-02", "in", "20", "78")];
    let rows = ledger(moves);
    eq(rows.at(-1)!.quantity, "30");
    eq(rows.at(-1)!.value, "2360");
    eq(rows.at(-1)!.average, new D("2360").div(30).toFixed());
    const needed = recipeQuantities(recipe, "18").get("1")!; // 250 g × 18 = 4,5 kg
    eq(needed, "4.5");
    const sale = mov(3, "2026-09-23", "out", needed.toFixed());
    rows = ledger([...moves, sale]);
    const row = rows.at(-1)!;
    eq(row.quantity, "25.5");
    near(row.cost, "354", "1e-20");
    near(row.value, "2006", "1e-20");
    sale.voided = true;
    eq(ledger([...moves, sale]).at(-1)!.quantity, "30");
  });

  it("el mismo día las entradas van antes que las salidas", () => {
    const rows = ledger([mov(2, "2026-09-01", "out", "5"), mov(9, "2026-09-01", "in", "10", "8")]);
    expect(rows.map((r) => r.movement.kind)).toEqual(["in", "out"]);
    eq(rows[1].cost, "40");
  });

  it("precio de kardex: catálogo, pendiente y promedio a una fecha", () => {
    expect(inventoryPrice([])).toEqual([null, "catalog"]);
    const moves = [mov(1, "2026-09-01", "in", "10", "80"), mov(2, "2026-09-05", "in", "10", "100")];
    const [avg, source] = inventoryPrice(moves, "2026-09-02");
    expect(source).toBe("kardex");
    eq(avg, "80");
    eq(inventoryPrice(moves)[0], "90");
    // Salida mayor al stock: valoración pendiente.
    expect(inventoryPrice([...moves, mov(3, "2026-09-06", "out", "25")])[1]).toBe("pending");
    // Stock en cero: se conserva el último promedio valorado.
    const [last, state] = inventoryPrice([...moves, mov(3, "2026-09-06", "out", "20")]);
    expect(state).toBe("kardex");
    eq(last, "90");
  });

  it("faltantes de stock, incluido lo reservado por salidas posteriores", () => {
    const moves = [mov(1, "2026-09-01", "in", "5", "80"), mov(2, "2026-09-20", "out", "4")];
    const need = recipeQuantities(recipe, "8"); // 2 kg
    // Al 10/09 hay 5 kg, pero el 20/09 ya salen 4: solo queda 1 kg disponible.
    const shortages = stockShortages(need, () => moves, "2026-09-10");
    expect(shortages).toHaveLength(1);
    eq(shortages[0].needed, "2");
    eq(shortages[0].available, "1");
    expect(stockShortages(recipeQuantities(recipe, "4"), () => moves, "2026-09-10")).toHaveLength(0);
  });
});
