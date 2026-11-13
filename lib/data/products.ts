import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Dec } from "@/lib/costing/decimal";
import { type Movement, type PriceSource, inventoryPrice, recipeQuantities, stockShortages } from "@/lib/costing/inventory";
import { type LineResult, type QuantityMode, recipeTotals } from "@/lib/costing/recipes";
import { versionResult } from "@/lib/costing/materials";
import { formatUnitPrice } from "@/lib/format";
import { type MovementRow, type VersionRow, fetchAll, getUnits, toCostVersion, toMovement } from "@/lib/data/materials";

const VERSION_COLUMNS =
  "id, material_id, effective_on, mode, source, created_at, unit_cost::text, quantity::text, purchase_unit, factor::text, conversion_evidence, net_amount::text, nonrecoverable_tax::text, recoverable_tax::text, attributable_cost::text, currency";
const MOVEMENT_COLUMNS = "id, material_id, movement_on, kind, quantity::text, unit_cost::text, reference, voided, sale_id, plan_id";

export type ProductRow = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  menu_category: string | null;
  source_key: string | null;
  active: boolean;
  revision: number;
};

export type RecipeVersionRow = {
  id: number;
  product_id: number;
  number: number;
  output_quantity: string;
  output_unit_code: string;
  product_name: string;
  created_at: string;
};

export type RecipeLineRow = {
  id: number;
  recipe_id: number;
  position: number;
  material_id: number;
  cost_version_id: number;
  material_name: string;
  quantity: string;
  unit_key: string;
  unit_label: string;
  factor: string;
  conversion_evidence: string;
  mode: QuantityMode;
  rate: string;
};

const LINE_COLUMNS =
  "id, recipe_id, position, material_id, cost_version_id, material_name, quantity::text, unit_key, unit_label, factor::text, conversion_evidence, mode, rate::text";

const chunks = <T>(items: T[], size = 150) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

export type CostedLine = RecipeLineRow & { result: LineResult; unitCost: Dec; priceSource: PriceSource | "version"; version: VersionRow | undefined };
export type CostedRecipe = { lines: CostedLine[]; total: Dec | null; perUnit: Dec | null; pricePending: boolean };

/**
 * Costo de materiales de una versión (legacy: ingredient_prices + calculation):
 * usa el promedio del kardex si existe a la fecha; si no, el precio guardado en la receta.
 */
function costRecipe(
  version: RecipeVersionRow,
  lines: RecipeLineRow[],
  versions: Map<number, VersionRow>,
  movementsOf: Map<number, Movement[]>,
  onDate: string,
): CostedRecipe {
  const priced = lines.map((line) => {
    const [average, source] = inventoryPrice(movementsOf.get(line.material_id) ?? [], onDate);
    const v = versions.get(line.cost_version_id);
    const unitCost = source === "kardex" ? average! : versionResult(toCostVersion(v!));
    return { line, unitCost, source: source === "kardex" ? ("kardex" as const) : source === "pending" ? ("pending" as const) : ("version" as const), v };
  });
  const [results, total, perUnit] = recipeTotals(
    priced.map(({ line, unitCost }) => ({ quantity: line.quantity, factor: line.factor, unitCost, mode: line.mode, rate: line.rate })),
    version.output_quantity,
  );
  return {
    lines: priced.map(({ line, unitCost, source, v }, i) => ({ ...line, result: results[i], unitCost, priceSource: source, version: v })),
    total,
    perUnit,
    pricePending: priced.some((p) => p.source === "pending"),
  };
}

async function loadCostInputs(supabase: Awaited<ReturnType<typeof createClient>>, restaurantId: string, lines: RecipeLineRow[]) {
  const versionIds = [...new Set(lines.map((l) => l.cost_version_id))];
  const versionRows = (
    await Promise.all(chunks(versionIds).map((ids) => supabase.from("material_cost_versions").select(VERSION_COLUMNS).in("id", ids)))
  ).flatMap((r) => (r.data ?? []) as unknown as VersionRow[]);
  const movements = await fetchAll<MovementRow>((a, b) =>
    supabase.from("inventory_movements").select(MOVEMENT_COLUMNS).eq("restaurant_id", restaurantId).eq("voided", false).order("id").range(a, b) as never,
  );
  const movementsOf = new Map<number, Movement[]>();
  for (const m of movements) movementsOf.set(m.material_id, [...(movementsOf.get(m.material_id) ?? []), toMovement(m)]);
  return { versions: new Map(versionRows.map((v) => [v.id, v])), movementsOf };
}

export type ProductSummary = ProductRow & { version: RecipeVersionRow; cost: CostedRecipe; price: string | null };

/** Platos con su versión vigente, costo de materiales por porción y precio de carta. */
export async function getProductSummaries(restaurantId: string, onDate: string): Promise<ProductSummary[]> {
  const supabase = await createClient();
  const [products, versions, { data: prices }] = await Promise.all([
    fetchAll<ProductRow>((a, b) =>
      supabase.from("products").select("id, code, name, description, menu_category, source_key, active, revision").eq("restaurant_id", restaurantId).order("name").range(a, b),
    ),
    fetchAll<RecipeVersionRow>((a, b) =>
      supabase
        .from("recipe_versions")
        .select("id, product_id, number, output_quantity::text, output_unit_code, product_name, created_at")
        .eq("restaurant_id", restaurantId)
        .order("id")
        .range(a, b) as never,
    ),
    supabase.from("product_prices").select("product_id, amount::text").eq("restaurant_id", restaurantId),
  ]);
  const latest = new Map<number, RecipeVersionRow>();
  for (const v of versions) if ((latest.get(v.product_id)?.number ?? 0) < v.number) latest.set(v.product_id, v);
  const ids = [...latest.values()].map((v) => v.id);
  const lines = (
    await Promise.all(chunks(ids).map((part) => supabase.from("recipe_lines").select(LINE_COLUMNS).in("recipe_id", part).order("position")))
  ).flatMap((r) => (r.data ?? []) as unknown as RecipeLineRow[]);
  const inputs = await loadCostInputs(supabase, restaurantId, lines);
  const priceOf = new Map(((prices ?? []) as unknown as { product_id: number; amount: string }[]).map((p) => [p.product_id, p.amount]));
  return products
    .filter((p) => latest.has(p.id))
    .map((p) => {
      const version = latest.get(p.id)!;
      return {
        ...p,
        version,
        cost: costRecipe(version, lines.filter((l) => l.recipe_id === version.id), inputs.versions, inputs.movementsOf, onDate),
        price: priceOf.get(p.id) ?? null,
      };
    });
}

/** Ficha de un plato: versión elegida (o la vigente) con su costo, historial y datos para editar. */
export async function getProductDetail(restaurantId: string, productId: number, versionNumber: number | null, onDate: string) {
  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("id, code, name, description, menu_category, source_key, active, revision")
    .eq("restaurant_id", restaurantId)
    .eq("id", productId)
    .maybeSingle();
  if (!product) return null;
  const [{ data: versionsData }, { data: price }] = await Promise.all([
    supabase
      .from("recipe_versions")
      .select("id, product_id, number, output_quantity::text, output_unit_code, product_name, created_at")
      .eq("product_id", productId)
      .order("number", { ascending: false }),
    supabase.from("product_prices").select("amount::text").eq("product_id", productId).maybeSingle(),
  ]);
  const versions = (versionsData ?? []) as unknown as RecipeVersionRow[];
  const current = versions[0];
  const version = versionNumber ? versions.find((v) => v.number === versionNumber) : current;
  if (!version) return null;
  const { data: lineData } = await supabase.from("recipe_lines").select(LINE_COLUMNS).eq("recipe_id", version.id).order("position");
  const lines = (lineData ?? []) as unknown as RecipeLineRow[];
  const inputs = await loadCostInputs(supabase, restaurantId, lines);
  const cost = costRecipe(version, lines, inputs.versions, inputs.movementsOf, onDate);
  // Faltantes para elaborar un lote hoy (informativo; legacy: recipe_shortages).
  const shortages = lines.length
    ? stockShortages(
        recipeQuantities(
          { outputQuantity: version.output_quantity, lines: lines.map((l) => ({ materialId: l.material_id, quantity: l.quantity, factor: l.factor, mode: l.mode, rate: l.rate })) },
          version.output_quantity,
        ),
        (id) => inputs.movementsOf.get(Number(id)) ?? [],
        onDate,
      )
    : [];
  return {
    product: product as ProductRow,
    versions,
    version,
    isCurrent: version.id === current.id,
    cost,
    shortages,
    price: (price as { amount: string } | null)?.amount ?? null,
  };
}

export type IngredientChoice = {
  id: number;
  name: string;
  baseUnit: string;
  baseSymbol: string;
  /** Precios en la moneda del restaurante, del más reciente al más antiguo. */
  prices: { id: number; label: string; effectiveOn: string }[];
  conversions: { id: number; label: string; factor: string }[];
};

/** Insumos activos con sus precios y presentaciones, para el formulario de la receta. */
export async function getIngredientChoices(restaurantId: string, currency: string) {
  const supabase = await createClient();
  const [materials, versions, { data: conversions }, units] = await Promise.all([
    fetchAll<{ id: number; name: string; variety: string | null; base_unit_code: string; active: boolean }>((a, b) =>
      supabase.from("materials").select("id, name, variety, base_unit_code, active").eq("restaurant_id", restaurantId).order("name").range(a, b),
    ),
    fetchAll<VersionRow & { currency: string }>((a, b) =>
      supabase.from("material_cost_versions").select(VERSION_COLUMNS).eq("restaurant_id", restaurantId).order("id").range(a, b) as never,
    ),
    supabase.from("material_conversions").select("id, material_id, label, factor::text").eq("restaurant_id", restaurantId),
    getUnits(supabase, restaurantId),
  ]);
  const choices: IngredientChoice[] = materials.map((m) => {
    const base = units.byCode.get(m.base_unit_code)!;
    return {
      id: m.id,
      name: m.variety ? `${m.name} ${m.variety}` : m.name,
      baseUnit: m.base_unit_code,
      baseSymbol: base.symbol,
      prices: versions
        .filter((v) => v.material_id === m.id && v.currency === currency)
        .sort((a, b) => (a.effective_on < b.effective_on ? 1 : a.effective_on > b.effective_on ? -1 : b.id - a.id))
        .map((v) => ({ id: v.id, effectiveOn: v.effective_on, label: formatUnitPrice(versionResult(toCostVersion(v)), currency) })),
      conversions: ((conversions ?? []) as unknown as { id: number; material_id: number; label: string; factor: string }[])
        .filter((c) => c.material_id === m.id)
        .map((c) => ({ id: c.id, label: c.label, factor: c.factor })),
    };
  });
  return { choices, active: new Set(materials.filter((m) => m.active).map((m) => m.id)), units };
}

export type CatalogDish = { id: number; name: string; description: string | null; portions: string; category: string | null; ingredients: number };

export async function getCatalogDishes(): Promise<CatalogDish[]> {
  const supabase = await createClient();
  const [{ data: dishes }, { data: details }] = await Promise.all([
    supabase.from("catalogo_platos").select("id_plato, nombre, descripcion, porciones::text, categoria_menu").order("categoria_menu").order("nombre"),
    supabase.from("catalogo_receta_detalles").select("id_plato"),
  ]);
  const count = new Map<number, number>();
  for (const d of details ?? []) count.set(d.id_plato, (count.get(d.id_plato) ?? 0) + 1);
  return ((dishes ?? []) as unknown as { id_plato: number; nombre: string; descripcion: string | null; porciones: string; categoria_menu: string | null }[]).map((d) => ({
    id: d.id_plato,
    name: d.nombre,
    description: d.descripcion,
    portions: d.porciones,
    category: d.categoria_menu,
    ingredients: count.get(d.id_plato) ?? 0,
  }));
}
