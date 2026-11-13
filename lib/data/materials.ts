import "server-only";
import { createClient } from "@/lib/supabase/server";
import { type CostVersion, effectiveVersion, versionResult } from "@/lib/costing/materials";
import { type Movement, ledger } from "@/lib/costing/inventory";
import type { Dec } from "@/lib/costing/decimal";
import type { UnitRow } from "@/lib/materials";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Lee todas las filas en páginas de 1000 (límite de PostgREST). */
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const size = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < size) return rows;
  }
}

// Los importes se piden como texto (::text): numeric de Postgres llega exacto, sin pasar por float.
const VERSION_COLUMNS =
  "id, material_id, effective_on, mode, source, created_at, unit_cost::text, quantity::text, purchase_unit, factor::text, conversion_evidence, net_amount::text, nonrecoverable_tax::text, recoverable_tax::text, attributable_cost::text";
const MOVEMENT_COLUMNS = "id, material_id, movement_on, kind, quantity::text, unit_cost::text, reference, voided, sale_id, plan_id";

export type VersionRow = {
  id: number;
  material_id: number;
  effective_on: string;
  mode: "direct" | "purchase";
  source: string;
  created_at: string;
  unit_cost: string | null;
  quantity: string | null;
  purchase_unit: string | null;
  factor: string | null;
  conversion_evidence: string | null;
  net_amount: string | null;
  nonrecoverable_tax: string | null;
  recoverable_tax: string | null;
  attributable_cost: string | null;
};

export type MovementRow = {
  id: number;
  material_id: number;
  movement_on: string;
  kind: "in" | "out";
  quantity: string;
  unit_cost: string;
  reference: string;
  voided: boolean;
  sale_id: number | null;
  plan_id: number | null;
};

export type MaterialRow = {
  id: number;
  code: string;
  name: string;
  variety: string | null;
  category: string;
  supplier: string | null;
  base_unit_code: string;
  active: boolean;
  catalog_material_id: number | null;
};

/** Versión de precio → entrada del motor. */
export function toCostVersion(v: VersionRow): CostVersion & { id: number; effectiveOn: string } {
  return v.mode === "direct"
    ? { id: v.id, effectiveOn: v.effective_on, mode: "direct", unitCost: v.unit_cost ?? "0" }
    : {
        id: v.id,
        effectiveOn: v.effective_on,
        mode: "purchase",
        quantity: v.quantity!,
        factor: v.factor!,
        netAmount: v.net_amount!,
        nonrecoverableTax: v.nonrecoverable_tax!,
        attributableCost: v.attributable_cost!,
        recoverableTax: v.recoverable_tax!,
      };
}

export const toMovement = (m: MovementRow): Movement & MovementRow => ({
  ...m,
  materialId: m.material_id,
  movementOn: m.movement_on,
  unitCost: m.unit_cost,
});

export async function getUnits(supabase: Client, restaurantId: string) {
  const [{ data: units }, { data: settings }] = await Promise.all([
    supabase.from("units").select("code, name, symbol, dimension, numerator, denominator"),
    supabase.from("restaurant_units").select("unit_code, enabled").eq("restaurant_id", restaurantId),
  ]);
  const all = (units ?? []) as UnitRow[];
  const saved = new Map((settings ?? []).map((s) => [s.unit_code, s.enabled]));
  // Sin configuración guardada, todas las unidades están habilitadas.
  const enabled = all.filter((u) => (saved.size ? saved.get(u.code) === true : true));
  return { all, enabled, byCode: new Map(all.map((u) => [u.code, u])) };
}

export type MaterialSummary = MaterialRow & {
  price: Dec | null;
  priceOn: string | null;
  stock: Dec | null;
  average: Dec | null;
  pending: boolean;
};

/** Insumos del restaurante con su precio vigente a `onDate` y su saldo de kardex. */
export async function getMaterialSummaries(restaurantId: string, onDate: string): Promise<MaterialSummary[]> {
  const supabase = await createClient();
  const [materials, versions, movements] = await Promise.all([
    fetchAll<MaterialRow>((a, b) =>
      supabase
        .from("materials")
        .select("id, code, name, variety, category, supplier, base_unit_code, active, catalog_material_id")
        .eq("restaurant_id", restaurantId)
        .order("name")
        .order("id")
        .range(a, b),
    ),
    fetchAll<VersionRow>((a, b) =>
      supabase.from("material_cost_versions").select(VERSION_COLUMNS).eq("restaurant_id", restaurantId).order("id").range(a, b) as never,
    ),
    fetchAll<MovementRow>((a, b) =>
      supabase.from("inventory_movements").select(MOVEMENT_COLUMNS).eq("restaurant_id", restaurantId).eq("voided", false).order("id").range(a, b) as never,
    ),
  ]);
  const byMaterial = <T extends { material_id: number }>(rows: T[]) => {
    const map = new Map<number, T[]>();
    for (const r of rows) map.set(r.material_id, [...(map.get(r.material_id) ?? []), r]);
    return map;
  };
  const versionsOf = byMaterial(versions);
  const movementsOf = byMaterial(movements);
  return materials.map((m) => {
    const version = effectiveVersion((versionsOf.get(m.id) ?? []).map(toCostVersion), onDate);
    const rows = ledger((movementsOf.get(m.id) ?? []).map(toMovement));
    const last = rows.at(-1);
    return {
      ...m,
      price: version ? versionResult(version) : null,
      priceOn: version?.effectiveOn ?? null,
      stock: last ? last.quantity : null,
      average: last?.average ?? null,
      pending: Boolean(last && last.value === null),
    };
  });
}

/** Ficha completa de un insumo del restaurante (null si no existe o no es visible por RLS). */
export async function getMaterialDetail(restaurantId: string, id: number) {
  const supabase = await createClient();
  const { data: material } = await supabase
    .from("materials")
    .select("id, code, name, variety, category, supplier, base_unit_code, active, catalog_material_id, created_at")
    .eq("restaurant_id", restaurantId)
    .eq("id", id)
    .maybeSingle();
  if (!material) return null;
  const [{ data: versions }, { data: conversions }, movements, units] = await Promise.all([
    supabase.from("material_cost_versions").select(VERSION_COLUMNS).eq("material_id", id).order("effective_on").order("id"),
    supabase.from("material_conversions").select("id, label, factor::text, evidence, created_at").eq("material_id", id).order("id"),
    fetchAll<MovementRow>((a, b) =>
      supabase.from("inventory_movements").select(MOVEMENT_COLUMNS).eq("material_id", id).order("id").range(a, b) as never,
    ),
    getUnits(supabase, restaurantId),
  ]);
  return {
    material: material as MaterialRow & { created_at: string },
    versions: (versions ?? []) as unknown as VersionRow[],
    conversions: (conversions ?? []) as unknown as { id: number; label: string; factor: string; evidence: string; created_at: string }[],
    movements,
    units,
  };
}

export type CatalogItem = {
  id_insumo: number;
  codigo_comercial: string;
  nombre: string;
  variedad: string | null;
  precio_mayorista: string;
  activo: boolean;
  categoria: string;
  unidad: string;
};

export async function getCatalog(): Promise<CatalogItem[]> {
  const supabase = await createClient();
  const rows = await fetchAll<{
    id_insumo: number;
    codigo_comercial: string;
    nombre: string;
    variedad: string | null;
    precio_mayorista: string;
    activo: boolean;
    catalogo_categorias: { nombre: string } | null;
    catalogo_unidades_medida: { codigo: string } | null;
  }>((a, b) =>
    supabase
      .from("catalogo_insumos")
      .select("id_insumo, codigo_comercial, nombre, variedad, precio_mayorista::text, activo, catalogo_categorias(nombre), catalogo_unidades_medida(codigo)")
      .order("nombre")
      .order("id_insumo")
      .range(a, b) as never,
  );
  return rows.map((r) => ({
    id_insumo: r.id_insumo,
    codigo_comercial: r.codigo_comercial,
    nombre: r.nombre,
    variedad: r.variedad,
    precio_mayorista: r.precio_mayorista,
    activo: r.activo,
    categoria: r.catalogo_categorias?.nombre ?? "Sin categoría",
    unidad: r.catalogo_unidades_medida?.codigo ?? "",
  }));
}

export async function getCategories(restaurantId: string): Promise<string[]> {
  const supabase = await createClient();
  const [{ data: catalog }, { data: own }] = await Promise.all([
    supabase.from("catalogo_categorias").select("nombre").order("nombre"),
    supabase.from("materials").select("category").eq("restaurant_id", restaurantId),
  ]);
  return [...new Set([...(catalog ?? []).map((c) => c.nombre), ...(own ?? []).map((m) => m.category)])].sort((a, b) => a.localeCompare(b, "es"));
}
