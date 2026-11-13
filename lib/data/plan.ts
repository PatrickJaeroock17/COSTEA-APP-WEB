import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { ENGINE, type PlanInput, type PlanLineInput, type PlanResult, type PricingMode, calculatePlan } from "@/lib/costing/costing";
import { D, plain } from "@/lib/costing/decimal";
import { inventoryPrice, type Movement } from "@/lib/costing/inventory";
import { versionResult } from "@/lib/costing/materials";
import type { QuantityMode } from "@/lib/costing/recipes";
import { type MovementRow, type VersionRow, fetchAll, toCostVersion, toMovement } from "@/lib/data/materials";
import { getEmployees, getPeriodCosts, staffInputs } from "@/lib/data/personal";
import { getConcepts } from "@/lib/data/expenses";
import { periodLabel } from "@/lib/restaurants";

export type PlanRow = {
  id: number;
  period_id: number;
  name: string;
  price_date: string;
  no_cif: boolean;
  no_expenses: boolean;
  active: boolean;
  calculation_hash: string | null;
  created_at: string;
};

export type PlanLineRow = {
  id: number;
  product_id: number;
  recipe_id: number;
  quantity: string;
  reference_price: string;
  equivalent_factor: string;
  pricing_mode: PricingMode;
  pricing_value: string;
  adopted_price: string | null;
  tax_rate: string | null;
};

const PLAN_COLUMNS = "id, period_id, name, price_date, no_cif, no_expenses, active, calculation_hash, created_at";
const LINE_COLUMNS =
  "id, product_id, recipe_id, quantity::text, reference_price::text, equivalent_factor::text, pricing_mode, pricing_value::text, adopted_price::text, tax_rate::text";

export async function getPlans(restaurantId: string, periodId: number): Promise<PlanRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("production_plans").select(PLAN_COLUMNS).eq("restaurant_id", restaurantId).eq("period_id", periodId).order("id", { ascending: false });
  return (data ?? []) as PlanRow[];
}

export async function getPlan(restaurantId: string, planId: number): Promise<PlanRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("production_plans").select(PLAN_COLUMNS).eq("restaurant_id", restaurantId).eq("id", planId).maybeSingle();
  return (data as PlanRow) ?? null;
}

/** JSON con claves ordenadas (legacy: json.dumps(sort_keys=True, separators=(",", ":"))). */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export type PlanEvaluation = {
  plan: PlanRow;
  input: PlanInput & { meta: Record<string, unknown> };
  result: PlanResult;
  /** Huella SHA-256 de las entradas: si cambia, el cálculo revisado ya no vale (legacy: evaluate). */
  fingerprint: string;
  lines: (PlanLineRow & { productName: string; recipeNumber: number; latestNumber: number })[];
};

/**
 * Entradas del motor desde la base (legacy: planning.plan_input) y su cálculo.
 * Los insumos usan el promedio del kardex a la fecha de referencia del plan; si no hay kardex, el precio
 * guardado en la receta. Restaurantes: IGV 18 %.
 */
export async function evaluatePlan(restaurantId: string, plan: PlanRow, restaurant: { name: string; currency: string }): Promise<PlanEvaluation> {
  const supabase = await createClient();
  const [employees, costs, concepts, { data: lineData }, { data: period }] = await Promise.all([
    getEmployees(restaurantId),
    getPeriodCosts(restaurantId, plan.period_id),
    getConcepts(restaurantId, plan.period_id),
    supabase.from("plan_lines").select(LINE_COLUMNS).eq("plan_id", plan.id).order("id"),
    supabase.from("periods").select("year, month").eq("id", plan.period_id).single(),
  ]);
  const planLines = (lineData ?? []) as unknown as PlanLineRow[];
  const issues: string[] = [];

  // Personal: costo del mes de cada trabajador; los activos sin costo son un pendiente.
  const staff = staffInputs(employees, costs);
  const configured = new Set(costs.map((c) => c.employee_id));
  for (const e of employees) if (e.active && !configured.has(e.id)) issues.push(`${e.name}: falta configurar su costo mensual, incluso si es cero.`);

  // Recetas de las líneas, con sus insumos, trabajo y precios.
  const recipeIds = [...new Set(planLines.map((l) => l.recipe_id))];
  const productIds = [...new Set(planLines.map((l) => l.product_id))];
  const [{ data: versions }, { data: recipeLines }, { data: work }, { data: latest }] = await Promise.all([
    recipeIds.length
      ? supabase.from("recipe_versions").select("id, product_id, number, output_quantity::text, output_unit_code, currency, product_name").in("id", recipeIds)
      : Promise.resolve({ data: [] }),
    recipeIds.length
      ? supabase
          .from("recipe_lines")
          .select("recipe_id, position, material_id, cost_version_id, material_name, quantity::text, factor::text, mode, rate::text, conversion_evidence")
          .in("recipe_id", recipeIds)
          .order("position")
      : Promise.resolve({ data: [] }),
    recipeIds.length ? supabase.from("recipe_work").select("recipe_id, no_materials, no_labor, operations").in("recipe_id", recipeIds) : Promise.resolve({ data: [] }),
    productIds.length ? supabase.from("recipe_versions").select("product_id, number").in("product_id", productIds) : Promise.resolve({ data: [] }),
  ]);
  type RecipeRow = { id: number; product_id: number; number: number; output_quantity: string; output_unit_code: string; currency: string; product_name: string };
  type RecipeLine = { recipe_id: number; position: number; material_id: number; cost_version_id: number; material_name: string; quantity: string; factor: string; mode: QuantityMode; rate: string; conversion_evidence: string };
  const recipeOf = new Map(((versions ?? []) as unknown as RecipeRow[]).map((v) => [v.id, v]));
  const linesOf = new Map<number, RecipeLine[]>();
  for (const l of (recipeLines ?? []) as unknown as RecipeLine[]) linesOf.set(l.recipe_id, [...(linesOf.get(l.recipe_id) ?? []), l]);
  const workOf = new Map(
    ((work ?? []) as unknown as { recipe_id: number; no_materials: boolean; no_labor: boolean; operations: { employee_id: number; activity: string; minutes: string }[] }[]).map((w) => [w.recipe_id, w]),
  );
  const latestOf = new Map<number, number>();
  for (const v of (latest ?? []) as { product_id: number; number: number }[]) latestOf.set(v.product_id, Math.max(latestOf.get(v.product_id) ?? 0, v.number));

  const materialIds = [...new Set([...linesOf.values()].flat().map((l) => l.material_id))];
  const costIds = [...new Set([...linesOf.values()].flat().map((l) => l.cost_version_id))];
  const [{ data: materials }, { data: costRows }, movements, { data: units }] = await Promise.all([
    materialIds.length ? supabase.from("materials").select("id, base_unit_code").in("id", materialIds) : Promise.resolve({ data: [] }),
    costIds.length
      ? supabase
          .from("material_cost_versions")
          .select("id, material_id, effective_on, mode, source, created_at, currency, unit_cost::text, quantity::text, purchase_unit, factor::text, conversion_evidence, net_amount::text, nonrecoverable_tax::text, recoverable_tax::text, attributable_cost::text")
          .in("id", costIds)
      : Promise.resolve({ data: [] }),
    materialIds.length
      ? fetchAll<MovementRow>((a, b) =>
          supabase
            .from("inventory_movements")
            .select("id, material_id, movement_on, kind, quantity::text, unit_cost::text, reference, voided, sale_id, plan_id")
            .eq("restaurant_id", restaurantId)
            .eq("voided", false)
            .in("material_id", materialIds)
            .order("id")
            .range(a, b) as never,
        )
      : Promise.resolve([] as MovementRow[]),
    supabase.from("units").select("code, symbol"),
  ]);
  const baseOf = new Map(((materials ?? []) as { id: number; base_unit_code: string }[]).map((m) => [m.id, m.base_unit_code]));
  const costOf = new Map(((costRows ?? []) as unknown as (VersionRow & { currency: string })[]).map((c) => [c.id, c]));
  const symbolOf = new Map(((units ?? []) as { code: string; symbol: string }[]).map((u) => [u.code, u.symbol]));
  const movementsOf = new Map<number, Movement[]>();
  for (const m of movements) movementsOf.set(m.material_id, [...(movementsOf.get(m.material_id) ?? []), toMovement(m)]);

  const lines: PlanLineInput[] = planLines.map((line) => {
    const recipe = recipeOf.get(line.recipe_id)!;
    const w = workOf.get(recipe.id);
    if (recipe.currency !== restaurant.currency) issues.push(`${recipe.product_name}: la moneda del precio o receta no coincide.`);
    const mats = (linesOf.get(recipe.id) ?? []).map((m) => {
      const cost = costOf.get(m.cost_version_id)!;
      const [average, source] = inventoryPrice(movementsOf.get(m.material_id) ?? [], plan.price_date);
      if (source !== "kardex" && cost.effective_on > plan.price_date) {
        issues.push(`${recipe.product_name}: el precio de ${m.material_name} tiene vigencia posterior a la fecha de referencia. Revisa la receta o la fecha del plan.`);
      }
      if (source !== "kardex" && cost.currency !== restaurant.currency) issues.push(`${recipe.product_name}: la moneda del precio o receta no coincide.`);
      if (source === "pending") {
        issues.push(`${recipe.product_name}: el kardex de ${m.material_name} tiene valoración pendiente; registra las entradas faltantes.`);
      }
      return {
        name: m.material_name,
        materialId: m.material_id,
        baseUnit: symbolOf.get(baseOf.get(m.material_id) ?? "") ?? "unidad base",
        version: cost.id,
        quantity: m.quantity,
        factor: m.factor,
        mode: m.mode,
        rate: m.rate,
        unitCost: source === "kardex" ? average!.toFixed() : versionResult(toCostVersion(cost)).toFixed(),
        origin: source === "kardex" ? "Promedio ponderado del kardex" : source === "pending" ? "Kardex pendiente; precio de receta provisional" : cost.source,
        priceSource: source,
        effectiveOn: cost.effective_on,
      };
    });
    return {
      id: line.id,
      productId: line.product_id,
      recipeId: recipe.id,
      recipeNumber: recipe.number,
      name: recipe.product_name,
      unit: symbolOf.get(recipe.output_unit_code) ?? recipe.output_unit_code,
      output: recipe.output_quantity,
      quantity: line.quantity,
      referencePrice: line.reference_price,
      equivalentFactor: line.equivalent_factor,
      pricingMode: line.pricing_mode,
      pricingValue: line.pricing_value,
      adoptedPrice: line.adopted_price,
      tax: "0.18",
      materials: mats,
      pricePending: mats.some((m) => m.priceSource === "pending"),
      operations: (w?.operations ?? []).map((op) => ({ employeeId: op.employee_id, activity: op.activity, minutes: op.minutes })),
      noMaterials: Boolean(w?.no_materials),
      noLabor: Boolean(w?.no_labor),
    };
  });

  const input = {
    staff,
    noCif: plan.no_cif,
    noExpenses: plan.no_expenses,
    concepts: concepts
      .filter((c) => c.active)
      .sort((a, b) => a.id - b.id)
      .map((c) => ({ id: `concept-${c.id}`, name: c.name, kind: c.kind, amount: c.amount, basis: c.basis, targets: c.targets, justification: c.justification, behavior: c.behavior })),
    lines,
    issues,
    meta: {
      engine: ENGINE,
      restaurant: restaurant.name,
      currency: restaurant.currency,
      period: period ? periodLabel(period.year, period.month) : "",
      periodId: plan.period_id,
      plan: plan.name,
      planId: plan.id,
      priceDate: plan.price_date,
      assumption: "Producción igual a ventas; sin inventarios ni productos en proceso; consumo proporcional de lotes.",
    },
  };
  const fingerprint = createHash("sha256").update(stableJson(plain(input))).digest("hex");
  const productName = new Map([...recipeOf.values()].map((r) => [r.product_id, r.product_name]));
  return {
    plan,
    input,
    result: calculatePlan(input),
    fingerprint,
    lines: planLines.map((l) => ({
      ...l,
      productName: productName.get(l.product_id) ?? "",
      recipeNumber: recipeOf.get(l.recipe_id)?.number ?? 0,
      latestNumber: latestOf.get(l.product_id) ?? 0,
    })),
  };
}

export type DishOption = { productId: number; name: string; recipeNumber: number; quantity: string; price: string; factor: string; origin: string };

/** Platos activos con receta para crear un plan (legacy: plan_dish_options). */
export async function getDishOptions(restaurantId: string, periodId: number): Promise<DishOption[]> {
  const supabase = await createClient();
  const [{ data: products }, { data: versions }, { data: prices }, { data: previous }] = await Promise.all([
    supabase.from("products").select("id, name").eq("restaurant_id", restaurantId).eq("active", true).order("name"),
    supabase.from("recipe_versions").select("product_id, number").eq("restaurant_id", restaurantId),
    supabase.from("product_prices").select("product_id, amount::text").eq("restaurant_id", restaurantId),
    supabase
      .from("plan_lines")
      .select("product_id, quantity::text, equivalent_factor::text, pricing_mode, pricing_value::text, adopted_price::text, production_plans!inner(period_id)")
      .eq("restaurant_id", restaurantId)
      .eq("production_plans.period_id", periodId)
      .order("id", { ascending: false }),
  ]);
  const latest = new Map<number, number>();
  for (const v of (versions ?? []) as { product_id: number; number: number }[]) latest.set(v.product_id, Math.max(latest.get(v.product_id) ?? 0, v.number));
  const priceOf = new Map(((prices ?? []) as unknown as { product_id: number; amount: string }[]).map((p) => [p.product_id, p.amount]));
  type Prev = { product_id: number; quantity: string; equivalent_factor: string; pricing_mode: string; pricing_value: string; adopted_price: string | null };
  const prevOf = new Map<number, Prev>();
  for (const p of (previous ?? []) as unknown as Prev[]) if (!prevOf.has(p.product_id)) prevOf.set(p.product_id, p);
  return ((products ?? []) as { id: number; name: string }[])
    .filter((p) => latest.has(p.id))
    .map((p) => {
      const prev = prevOf.get(p.id);
      const price = priceOf.get(p.id) ?? prev?.adopted_price ?? (prev?.pricing_mode === "manual" ? prev.pricing_value : null);
      return {
        productId: p.id,
        name: p.name,
        recipeNumber: latest.get(p.id)!,
        quantity: prev?.quantity ?? "",
        price: price ?? "",
        factor: prev?.equivalent_factor ?? "1",
        origin: prev ? "Datos propuestos del mismo mes" : priceOf.has(p.id) ? "Precio guardado" : "Completa cantidad y precio",
      };
    });
}

/** Platos de los planes de un mes para completar su reparto desde un gasto (legacy: allocation_line_id). */
export async function getAllocationLines(restaurantId: string, periodId: number): Promise<{ id: number; label: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plan_lines")
    .select("id, quantity::text, reference_price::text, equivalent_factor::text, products(name), production_plans!inner(name, period_id)")
    .eq("restaurant_id", restaurantId)
    .eq("production_plans.period_id", periodId)
    .order("plan_id", { ascending: false })
    .order("id");
  type Row = { id: number; quantity: string; reference_price: string; equivalent_factor: string; products: { name: string } | null; production_plans: { name: string } };
  const n = (x: string) => new D(x).toDecimalPlaces(2).toFixed();
  return ((data ?? []) as unknown as Row[]).map((l) => ({
    id: l.id,
    label: `${l.products?.name ?? "Plato"} · ${l.production_plans.name} · ${n(l.quantity)} porciones · venta ref. ${n(l.reference_price)} · factor ${n(l.equivalent_factor)}`,
  }));
}
