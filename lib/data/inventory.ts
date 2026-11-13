import "server-only";
import { createClient } from "@/lib/supabase/server";
import { D, type Dec, sum } from "@/lib/costing/decimal";
import { type LedgerRow, type Movement, ledger } from "@/lib/costing/inventory";
import type { QuantityMode } from "@/lib/costing/recipes";
import { type MaterialRow, type MovementRow, fetchAll, getUnits, toMovement } from "@/lib/data/materials";
import { type DishRecipe, type Simulation, recipeRequirements, simulateOutput } from "@/lib/inventory-view";

const MOVEMENT_COLUMNS = "id, material_id, movement_on, kind, quantity::text, unit_cost::text, reference, voided, sale_id, plan_id";

export type StockRow = MaterialRow & {
  unit: string;
  rows: LedgerRow<Movement & MovementRow>[];
  quantity: Dec | null;
  value: Dec | null;
  average: Dec | null;
  pending: boolean;
  dishes: string[];
  simulation: Simulation | null;
};

/**
 * Existencias valorizadas y demanda de la carta (legacy: inventory.index). `productId` limita la vista a
 * los insumos de la receta vigente de ese plato.
 */
export async function getInventory(restaurantId: string, productId: number | null) {
  const supabase = await createClient();
  const [materials, movements, products, versions, units] = await Promise.all([
    fetchAll<MaterialRow>((a, b) =>
      supabase.from("materials").select("id, code, name, variety, category, supplier, base_unit_code, active, catalog_material_id").eq("restaurant_id", restaurantId).order("name").order("id").range(a, b),
    ),
    fetchAll<MovementRow>((a, b) => supabase.from("inventory_movements").select(MOVEMENT_COLUMNS).eq("restaurant_id", restaurantId).order("id").range(a, b) as never),
    fetchAll<{ id: number; name: string }>((a, b) => supabase.from("products").select("id, name").eq("restaurant_id", restaurantId).eq("active", true).order("name").range(a, b)),
    fetchAll<{ id: number; product_id: number; number: number }>((a, b) => supabase.from("recipe_versions").select("id, product_id, number").eq("restaurant_id", restaurantId).order("id").range(a, b)),
    getUnits(supabase, restaurantId),
  ]);

  // Receta vigente de cada plato activo.
  const latest = new Map<number, { id: number; number: number }>();
  for (const v of versions) if ((latest.get(v.product_id)?.number ?? 0) < v.number) latest.set(v.product_id, v);
  const recipeIds = products.map((p) => latest.get(p.id)?.id).filter(Boolean) as number[];
  const lines = recipeIds.length
    ? await fetchAll<{ recipe_id: number; material_id: number; quantity: string; factor: string; mode: QuantityMode; rate: string }>((a, b) =>
        supabase.from("recipe_lines").select("recipe_id, material_id, quantity::text, factor::text, mode, rate::text").in("recipe_id", recipeIds).order("id").range(a, b) as never,
      )
    : [];
  const dishes: DishRecipe[] = products
    .filter((p) => latest.has(p.id))
    .map((p) => ({
      dish: p.name,
      lines: lines.filter((l) => l.recipe_id === latest.get(p.id)!.id).map((l) => ({ materialId: l.material_id, quantity: l.quantity, factor: l.factor, mode: l.mode, rate: l.rate })),
    }));
  const requirements = recipeRequirements(dishes);
  const filterIds = productId ? new Set(lines.filter((l) => l.recipe_id === latest.get(productId)?.id).map((l) => l.material_id)) : null;

  const movesOf = new Map<number, (Movement & MovementRow)[]>();
  for (const m of movements) movesOf.set(m.material_id, [...(movesOf.get(m.material_id) ?? []), toMovement(m)]);

  const rows: StockRow[] = materials
    .filter((m) => !filterIds || filterIds.has(m.id))
    .map((m) => {
      const rowsOf = ledger(movesOf.get(m.id) ?? []);
      const last = rowsOf.at(-1);
      const req = requirements.get(String(m.id));
      return {
        ...m,
        unit: units.byCode.get(m.base_unit_code)?.symbol ?? m.base_unit_code,
        rows: rowsOf,
        quantity: last?.quantity ?? null,
        value: last ? last.value : null,
        average: last?.average ?? null,
        pending: Boolean(last && last.value === null),
        dishes: req?.dishes ?? [],
        simulation: req ? simulateOutput(last ? { quantity: last.quantity, value: last.value } : null, req.quantity) : null,
      };
    });

  const opening = movements.filter((m) => !m.voided && m.reference === "Stock inicial · catálogo");
  return {
    rows,
    products: products.filter((p) => latest.has(p.id)),
    totalValue: sum(rows.filter((r) => r.value).map((r) => r.value!)),
    opening: { count: opening.length, value: sum(opening.map((m) => toMovement(m)).map((m) => ledgerValue(m))) },
  };
}

const ledgerValue = (m: Movement) => new D(m.quantity).times(m.unitCost);

export type SavedPurchase = { id: number; materialId: number; material: string; unit: string; quantity: string; unitCost: string; date: string; source: string };

/** Compras con comprobante (versiones en modo compra) aún no incorporadas al kardex (legacy: saved_entries). */
export async function getSavedPurchases(restaurantId: string): Promise<SavedPurchase[]> {
  const supabase = await createClient();
  const [{ data: versions }, { data: imported }, { data: materials }, units] = await Promise.all([
    supabase
      .from("material_cost_versions")
      .select("id, material_id, effective_on, source, quantity::text, factor::text, net_amount::text, nonrecoverable_tax::text, attributable_cost::text")
      .eq("restaurant_id", restaurantId)
      .eq("mode", "purchase")
      .order("effective_on", { ascending: false }),
    supabase.from("inventory_movements").select("reference").eq("restaurant_id", restaurantId).like("reference", "Compra guardada #%"),
    supabase.from("materials").select("id, name, variety, base_unit_code").eq("restaurant_id", restaurantId),
    getUnits(supabase, restaurantId),
  ]);
  const done = new Set(((imported ?? []) as { reference: string }[]).map((m) => m.reference));
  const matOf = new Map(((materials ?? []) as { id: number; name: string; variety: string | null; base_unit_code: string }[]).map((m) => [m.id, m]));
  type V = { id: number; material_id: number; effective_on: string; source: string; quantity: string; factor: string; net_amount: string; nonrecoverable_tax: string; attributable_cost: string };
  return ((versions ?? []) as unknown as V[])
    .filter((v) => !done.has(`Compra guardada #${v.id}`) && matOf.has(v.material_id))
    .map((v) => {
      const m = matOf.get(v.material_id)!;
      const qty = new D(v.quantity).times(v.factor);
      return {
        id: v.id,
        materialId: v.material_id,
        material: m.variety ? `${m.name} ${m.variety}` : m.name,
        unit: units.byCode.get(m.base_unit_code)?.symbol ?? m.base_unit_code,
        quantity: qty.toFixed(),
        unitCost: new D(v.net_amount).plus(v.nonrecoverable_tax).plus(v.attributable_cost).div(qty).toFixed(),
        date: v.effective_on,
        source: v.source,
      };
    });
}
