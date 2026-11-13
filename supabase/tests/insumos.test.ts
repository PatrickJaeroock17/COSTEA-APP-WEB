// Fase 6: insumos (códigos, catálogo, insumos propios, compras al kardex, historial inmutable y RLS).
// Equivale a los casos con base de datos de test_materials.py, test_inventory.py y test_restaurant_flow.py.
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, uid } from "./db";

const A = uid(11);
const B = uid(12);
let t: Awaited<ReturnType<typeof createDb>>;
let ra: string;
let rb: string;

beforeAll(async () => {
  t = await createDb();
  await t.signUp(A, { name: "Ana", restaurant: "El Puerto" });
  await t.signUp(B, { name: "Beto" });
  [{ id: ra }] = await t.as<{ id: string }>(A, "select id from restaurants");
  [{ id: rb }] = await t.as<{ id: string }>(B, "select public.create_restaurant('Don Beto SAC', null, 'peru_ruc', null, 'USD') id");
}, 60_000);

const one = async <T>(uid: string, sql: string, params: unknown[] = []) => (await t.as<T>(uid, sql, params))[0];

describe("códigos comerciales", () => {
  it("prefijo de categoría como el original", async () => {
    const rows = await t.db.query<{ a: string; b: string; c: string; d: string; e: string }>(
      "select public.category_prefix('Abarrotes, Granos y Condimentos') a, public.category_prefix('Lácteos y Huevos') b, public.category_prefix('De la Casa') c, public.category_prefix('') d, public.category_prefix('Té') e",
    );
    expect(rows.rows[0]).toEqual({ a: "ABA", b: "LAC", c: "CAS", d: "INS", e: "TEX" });
  });

  it("el catálogo tiene códigos únicos correlativos por prefijo", async () => {
    const { rows } = await t.db.query<{ codigo_comercial: string }>(
      "select codigo_comercial from catalogo_insumos where id_insumo in (1, 2) order by id_insumo",
    );
    expect(rows.map((r) => r.codigo_comercial)).toEqual(["PES-001", "PES-002"]);
  });
});

describe("stock inicial del catálogo", () => {
  it("el restaurante en soles recibe una sola vez los insumos con stock de apertura", async () => {
    const expected = (await t.db.query<{ n: number }>("select count(*)::int n from catalogo_insumos where activo and stock_inicial > 0")).rows[0].n;
    expect(expected).toBeGreaterThan(0);
    const a = await one<{ m: number; mv: number }>(
      A,
      "select (select count(*) from materials where restaurant_id = $1)::int m, (select count(*) from inventory_movements where restaurant_id = $1 and reference = 'Stock inicial · catálogo')::int mv",
      [ra],
    );
    expect(a).toEqual({ m: expected, mv: expected });
    // Corvina filete: 6.5 kg a 75.
    const corvina = await one<{ q: string; c: string; v: number }>(
      A,
      "select mv.quantity::text q, mv.unit_cost::text c, (select count(*) from material_cost_versions where material_id = m.id)::int v from materials m join inventory_movements mv on mv.material_id = m.id where m.restaurant_id = $1 and m.catalog_material_id = 1",
      [ra],
    );
    expect(corvina).toEqual({ q: "6.500", c: "75.00", v: 1 });
    // Repetir no duplica nada.
    await t.db.query("select public._seed_catalog_opening($1)", [ra]);
    expect(await one(A, "select count(*)::int n from inventory_movements where restaurant_id = $1", [ra])).toEqual({ n: expected });
  });

  it("un restaurante en dólares no recibe precios del catálogo", async () => {
    expect(await one(B, "select count(*)::int n from materials where restaurant_id = $1", [rb])).toEqual({ n: 0 });
    const e = await t.fails(B, "select public.add_catalog_material($1, 3)", [rb]);
    expect(e?.message).toMatch(/soles/);
  });
});

describe("agregar desde el catálogo", () => {
  it("crea el insumo con su código y precio; repetir reactiva sin duplicar", async () => {
    const { id } = await one<{ id: number }>(A, "select public.add_catalog_material($1, 3) id", [ra]);
    const m = await one(A, "select code, name, variety, base_unit_code from materials where id = $1", [id]);
    expect(m).toMatchObject({ name: "Lenguado", variety: "Filete", base_unit_code: "kg" });
    await t.as(A, "update materials set active = false where id = $1", [id]);
    const again = await one<{ id: number }>(A, "select public.add_catalog_material($1, 3) id", [ra]);
    expect(again.id).toBe(id);
    expect(await one(A, "select active, (select count(*) from material_cost_versions where material_id = $1)::int v from materials where id = $1", [id])).toEqual({ active: true, v: 1 });
  });

  it("no permite cambiar el código de un insumo del catálogo ni la unidad base", async () => {
    const { id } = await one<{ id: number }>(A, "select id from materials where restaurant_id = $1 and catalog_material_id = 3", [ra]);
    expect((await t.fails(A, "update materials set code = 'ZZZ-001' where id = $1", [id]))?.code).toBe("P0001");
    expect((await t.fails(A, "update materials set base_unit_code = 'g' where id = $1", [id]))?.code).toBe("P0001");
  });
});

describe("insumos propios", () => {
  it("usan el siguiente código libre después de los del catálogo", async () => {
    const { n } = (await t.db.query<{ n: number }>("select count(*)::int n from catalogo_insumos where codigo_comercial like 'PES-%'")).rows[0];
    const { id } = await one<{ id: number }>(
      A,
      "select public.create_material($1, 'Bonito', 'Fresco', 'Pescados', 'kg', 18.5, '2026-11-01') id",
      [ra],
    );
    const m = await one<{ code: string; cost: string; source: string }>(
      A,
      "select m.code, v.unit_cost::text cost, v.source from materials m join material_cost_versions v on v.material_id = m.id where m.id = $1",
      [id],
    );
    expect(m.code).toBe(`PES-${String(n + 1).padStart(3, "0")}`);
    expect(m.cost).toBe("18.5");
    expect(m.source).toBe("Alta propia · El Puerto");
  });

  it("rechaza duplicados por nombre y variedad sin distinguir mayúsculas", async () => {
    const e = await t.fails(A, "select public.create_material($1, ' bonito ', 'FRESCO', 'Pescados', 'kg', 1, '2026-11-01')", [ra]);
    expect(e?.message).toMatch(/Ya existe Bonito Fresco con el código PES-/);
  });

  it("valida nombre, unidad y precio", async () => {
    expect(await t.fails(A, "select public.create_material($1, '', null, 'Pescados', 'kg', 1, '2026-11-01')", [ra])).not.toBeNull();
    expect(await t.fails(A, "select public.create_material($1, 'X', null, 'Pescados', 'zz', 1, '2026-11-01')", [ra])).not.toBeNull();
    expect(await t.fails(A, "select public.create_material($1, 'X', null, 'Pescados', 'kg', -1, '2026-11-01')", [ra])).not.toBeNull();
  });
});

describe("compras al kardex", () => {
  let id: number;
  const token = (n: number) => n.toString(16).padStart(32, "0");

  beforeAll(async () => {
    ({ id } = await one<{ id: number }>(A, "select public.create_material($1, 'Ají limo', null, 'Verduras y Hortalizas', 'kg', 10, '2026-11-01') id", [ra]));
  });

  it("la primera entrada es inventario inicial; convierte gramos a kg exactamente", async () => {
    await t.as(A, "select public.register_purchase($1, 500, 'unit:g', 0.012, '2026-11-02', $2)", [id, token(1)]);
    const mv = await one(A, "select quantity::text q, unit_cost::text c from inventory_movements where material_id = $1", [id]);
    expect(mv).toEqual({ q: "0.5", c: "12" });
    const v = await one(A, "select source from material_cost_versions where material_id = $1 order by id desc limit 1", [id]);
    expect(v).toEqual({ source: "Inventario inicial / Kardex · Gramo" });
  });

  it("equivalencias propias y la segunda entrada es compra", async () => {
    const { cid } = await one<{ cid: number }>(
      A,
      "insert into material_conversions (restaurant_id, material_id, label, factor, evidence) values ($1, $2, 'Bolsa 2 kg', 2, 'Etiqueta') returning id cid",
      [ra, id],
    );
    await t.as(A, "select public.register_purchase($1, 3, $2, 30, '2026-11-03', $3)", [id, `custom:${cid}`, token(2)]);
    const mv = await one(A, "select quantity::text q, unit_cost::text c from inventory_movements where material_id = $1 order by id desc limit 1", [id]);
    expect(mv).toEqual({ q: "6", c: "15" });
    const v = await one(A, "select source from material_cost_versions where material_id = $1 order by id desc limit 1", [id]);
    expect(v).toEqual({ source: "Compra / Kardex · Bolsa 2 kg" });
  });

  it("es idempotente y rechaza unidades incompatibles", async () => {
    const e = await t.fails(A, "select public.register_purchase($1, 1, 'unit:kg', 1, '2026-11-04', $2)", [id, token(2)]);
    expect(e?.message).toMatch(/ya fue registrada/);
    expect((await t.fails(A, "select public.register_purchase($1, 1, 'unit:l', 1, '2026-11-04', $2)", [id, token(3)]))?.message).toMatch(/compatible/);
  });
});

describe("historial inmutable y aislamiento", () => {
  it("las versiones de precio y equivalencias no se editan ni se borran", async () => {
    const { id } = await one<{ id: number }>(A, "select id from material_cost_versions where restaurant_id = $1 limit 1", [ra]);
    expect((await t.fails(A, "update material_cost_versions set source = 'x' where id = $1", [id]))?.code).toBe("P0001");
    expect((await t.fails(A, "delete from material_cost_versions where id = $1", [id]))?.code).toBe("P0001");
  });

  it("otro usuario no ve, no agrega ni compra insumos ajenos", async () => {
    expect(await t.as(B, "select id from materials where restaurant_id = $1", [ra])).toEqual([]);
    expect((await t.fails(B, "select public.add_catalog_material($1, 4)", [ra]))?.code).toBe("42501");
    expect((await t.fails(B, "select public.create_material($1, 'X', null, 'Pescados', 'kg', 1, '2026-11-01')", [ra]))?.code).toBe("42501");
    const { id } = await one<{ id: number }>(A, "select id from materials where restaurant_id = $1 limit 1", [ra]);
    expect((await t.fails(B, "select public.register_purchase($1, 1, 'unit:kg', 1, '2026-11-04', $2)", [id, "f".repeat(32)]))?.code).toBe("42501");
    expect(await t.fails(B, "select public._seed_catalog_opening($1)", [ra])).not.toBeNull();
  });
});
