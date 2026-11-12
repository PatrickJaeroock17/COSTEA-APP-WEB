// Port de legacy/Costea-main/costos_app/tests/test_costing_engine.py (+ casos puros de test_excel_improvements.py).
import { describe, expect, it } from "vitest";
import { allocation, calculatePlan, laborCost, price } from "../costing";
import { D } from "../decimal";
import { clone, employee, eq, mapText, scenario } from "./helpers";

describe("motor de costos", () => {
  it("mano de obra y recurso mixto", () => {
    const cost = laborCost(employee());
    eq(cost.minutes, "7680");
    eq(cost.rate, ".3125");
    eq(cost.rate!.times(8), "2.50");
    const mixed = laborCost(employee(".5"));
    eq(mixed.cost, "1200");
    eq(mixed.minutes, "3840");
    eq(mixed.rate, cost.rate!.toFixed());
    eq(mixed.indirect.cif, "1200");
  });

  it("MOD por cantidad sin doble cobro por varias actividades", () => {
    const data = scenario("800");
    Object.assign(data.staff[0], { directBasis: "quantity", plannedUnits: "800" });
    data.lines[0].operations.push({ employeeId: 1, activity: "Otra actividad", minutes: "0" });
    const result = calculatePlan(data);
    expect(result.status, result.issues.join(" | ")).toBe("calculable");
    eq(result.rows[0].mod, "3");
    eq(result.totals.modAssigned, "2400");
    eq(result.totals.idle, "0");
    eq(result.staff[0].requiredUnits, "800");
    data.lines[0].quantity = "801";
    expect(calculatePlan(data).status).toBe("capacidad_excedida");
  });

  it("consolida el mismo insumo con precios distintos", () => {
    const data = scenario("800");
    const second = clone(data.lines[0]);
    Object.assign(second, { id: 2, productId: 2, quantity: "100" });
    Object.assign(second.materials[0], { unitCost: "150", version: 2 });
    data.lines.push(second);
    const result = calculatePlan(data);
    expect(result.requirements).toHaveLength(1);
    const ingredient = result.requirements[0];
    eq(ingredient.quantity, "45");
    eq(ingredient.amount, "5550");
    expect(ingredient.priceVersions).toEqual([1, 2]);
  });

  it("conciliación completa: caso de comprobación de GUIA_RAPIDA.md", () => {
    const result = calculatePlan(scenario());
    expect(result.status, result.issues.join(" | ")).toBe("calculable");
    const t = result.totals;
    const expected = {
      cmp: "4800",
      modAvailable: "2400",
      modAssigned: "2000",
      idle: "400",
      cif: "800",
      expenses: "400",
      costs: "8400",
      sales: "12000",
      profit: "3600",
      margin: ".30",
      completeAssigned: "8000",
      bridge: "8400",
    } as const;
    for (const [key, value] of Object.entries(expected)) eq(t[key as keyof typeof t], value, key);
    eq(result.rows[0].complete, "10");
  });

  it("capacidad excedida bloquea la utilidad final", () => {
    const result = calculatePlan(scenario("1000"));
    expect(result.status).toBe("capacidad_excedida");
    eq(result.staff[0].excess, "320");
    expect(result.totals.profit).toBeNull();
  });

  it("reparto por bases, céntimos y base faltante", () => {
    expect(mapText(allocation("900", new Map([[1, "100"], [2, "200"]])).exact)).toEqual({ 1: "300", 2: "600" });
    expect(mapText(allocation("300", new Map([[1, "1000"], [2, "500"]])).exact)).toEqual({ 1: "200", 2: "100" });
    const rounded = allocation("100", new Map([[1, "1"], [2, "1"], [3, "1"]]));
    expect(mapText(rounded.rounded)).toEqual({ 1: "33.34", 2: "33.33", 3: "33.33" });
    eq([...rounded.exact.values()].reduce((a, b) => a.plus(b)), "100");
    eq(allocation("9", new Map([[1, "0"]])).unassigned, "9");
    eq(allocation("0", new Map([[1, "0"]])).unassigned, "0");
  });

  it("recargo, margen e impuesto manual", () => {
    let p = price("100", "markup", ".25", ".18");
    eq(p.net, "125");
    eq(p.final, "147.50");
    eq(p.margin, ".2");
    p = price("100", "margin", ".25", "0");
    eq(p.suggested, "133.3333333333333333333333333");
    eq(p.final, "133.33");
    p = price("80", "manual", "118", ".18");
    eq(p.net, "100");
    eq(p.tax, "18");
    eq(p.result, "20");
    eq(p.margin, ".2");
    expect(price("80", "manual", "0", ".18").margin).toBeNull();
    eq(price("80", "manual", "50", "0").result, "-30");
    expect(price("0", "manual", "0", "0").markup).toBeNull();
    expect(() => price("100", "margin", "1", "0")).toThrow();
  });

  it("planilla mixta se incluye una vez y el precio no es circular", () => {
    const data = scenario("400");
    data.staff = [employee(".5")];
    const result = calculatePlan(data);
    expect(result.status).toBe("calculable");
    eq(result.totals.modAvailable, "1200");
    eq(result.totals.cif, "2000"); // 800 + 1200 de sueldo trasladado
    eq(result.totals.costs, "6000"); // 2400 materiales + 2400 personal + 800 CIF + 400 gastos
    data.concepts[0].basis = "sales";
    const old = mapText(calculatePlan(data).allocations[0].exact);
    data.lines[0].pricingValue = "500";
    expect(mapText(calculatePlan(data).allocations[0].exact)).toEqual(old);
  });

  it.each(["missing_materials", "missing_labor", "no_tax", "zero_productivity", "zero_base", "zero_production"])(
    "entradas incompletas nunca dan utilidad final: %s",
    (change) => {
      const data = scenario();
      if (change === "missing_materials") data.lines[0].materials = [];
      if (change === "missing_labor") data.lines[0].operations = [];
      if (change === "no_tax") data.lines[0].tax = null;
      if (change === "zero_productivity") data.staff[0].productive = "0";
      if (change === "zero_base") data.concepts[0].targets = [999];
      if (change === "zero_production") data.lines[0].quantity = "0";
      const result = calculatePlan(data);
      expect(result.status).not.toBe("calculable");
      expect(result.totals.profit).toBeNull();
    },
  );

  it("componentes declarados como no aplicables y ventas cero", () => {
    const data = scenario();
    data.staff = [];
    data.concepts = [];
    data.noCif = true;
    data.noExpenses = true;
    Object.assign(data.lines[0], {
      materials: [],
      operations: [],
      noMaterials: true,
      noLabor: true,
      pricingMode: "manual",
      pricingValue: "0",
    });
    const result = calculatePlan(data);
    expect(result.status).toBe("calculable");
    eq(result.totals.profit, "0");
    expect(result.totals.margin).toBeNull();
  });
});

describe("mejoras del Excel (test_excel_improvements.py)", () => {
  it("tarifa por minuto del Excel (Hoja2 F58/G58)", () => {
    const data = employee();
    Object.assign(data, { components: [{ amount: "2725" }], days: "26", hours: "8", productive: ".9" });
    const cost = laborCost(data);
    eq(cost.minutes, "11232");
    eq(cost.rate, new D("2725").div("11232").toFixed());
  });

  it("food cost y gastos financieros concilian", () => {
    const p = price("12", "food_cost", ".30", ".18");
    eq(p.suggested, "47.20");
    eq(p.net, "40");
    eq(p.tax, "7.20");
    eq(p.costRatio, ".30");
    eq(price("12", "food_cost", ".3", "0").final, "40");
    eq(price("12", "food_cost", ".3", ".18", "59").costRatio, ".24");
    for (const invalid of ["0", "1.01"]) expect(() => price("12", "food_cost", invalid, ".18")).toThrow();
    const data = scenario();
    data.concepts.push({ ...data.concepts[1], id: "finance", kind: "finance", amount: "160" });
    Object.assign(data.lines[0], { pricingMode: "food_cost", pricingValue: ".3" });
    const result = calculatePlan(data);
    eq(result.rows[0].production, "9.5");
    eq(result.rows[0].complete, "10.2");
    eq(result.rows[0].finance, "160");
    eq(result.totals.finance, "160");
    eq(result.totals.difference, "0");
    eq(result.rows[0].price!.final, "40.12");
  });
});
