// Fase 7: platos y recetas (versiones, bloqueo optimista, equivalencias, catálogo, stock y borrado).
// Equivale a los casos con base de datos de test_products.py y test_restaurant_flow.py.
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, uid } from "./db";

const A = uid(21);
const B = uid(22);
let t: Awaited<ReturnType<typeof createDb>>;
let ra: string;
let limon: number; // insumo propio en kg
let costLimon: number;

const one = async <T = Record<string, unknown>>(u: string, sql: string, params: unknown[] = []) => (await t.as<T>(u, sql, params))[0];
const lines = (rows: object[]) => JSON.stringify(rows);

beforeAll(async () => {
  t = await createDb();
  await t.signUp(A, { name: "Ana", restaurant: "El Puerto" });
  await t.signUp(B, { name: "Beto", restaurant: "Otro" });
  ({ id: ra } = await one<{ id: string }>(A, "select id from restaurants"));
  ({ id: limon } = await one<{ id: number }>(A, "select public.create_material($1, 'Limón propio', null, 'Frutas', 'kg', 8, '2026-11-01') id", [ra]));
  ({ id: costLimon } = await one<{ id: number }>(A, "select id from material_cost_versions where material_id = $1", [limon]));
}, 60_000);

describe("platos propios y versiones", () => {
  let pid: number;

  it("crear un plato crea la versión 1 vacía", async () => {
    ({ id: pid } = await one<{ id: number }>(A, "select public.create_product($1, 'Ceviche de la casa', 'Corvina y limón', 'Ceviches', 2) id", [ra]));
    expect(await one(A, "select p.revision, v.number, v.output_quantity::text q from products p join recipe_versions v on v.product_id = p.id where p.id = $1", [pid])).toEqual({
      revision: 1,
      number: 1,
      q: "2",
    });
  });

  it("no admite nombres repetidos (sin importar mayúsculas ni espacios)", async () => {
    const e = await t.fails(A, "select public.create_product($1, '  ceviche   DE la casa ')", [ra]);
    expect(e?.message).toMatch(/Ya existe un plato/);
  });

  it("agregar un insumo crea la versión 2 con la equivalencia exacta", async () => {
    await t.as(A, "select public.save_recipe($1, 1, $2::jsonb)", [pid, lines([{ material_id: limon, cost_version_id: costLimon, quantity: "250", unit_key: "unit:g", mode: "loss", rate: "0.2" }])]);
    const line = await one(
      A,
      "select v.number, l.factor::text f, l.unit_label, l.conversion_evidence ev from recipe_lines l join recipe_versions v on v.id = l.recipe_id where v.product_id = $1",
      [pid],
    );
    expect(line).toEqual({ number: 2, f: "0.001", unit_label: "g", ev: "Equivalencia universal de unidades compatibles." });
  });

  it("rechaza versiones viejas, unidades incompatibles, merma inválida e insumos repetidos", async () => {
    const spec = { material_id: limon, cost_version_id: costLimon, quantity: "1", unit_key: "unit:kg", mode: "gross", rate: "0" };
    expect((await t.fails(A, "select public.save_recipe($1, 1, $2::jsonb)", [pid, lines([spec])]))?.message).toMatch(/cambió mientras/);
    expect((await t.fails(A, "select public.save_recipe($1, 2, $2::jsonb)", [pid, lines([{ ...spec, unit_key: "unit:l" }])]))?.message).toMatch(/equivalencia/);
    expect((await t.fails(A, "select public.save_recipe($1, 2, $2::jsonb)", [pid, lines([{ ...spec, mode: "loss", rate: "1" }])]))?.message).toMatch(/menor que 100/);
    expect((await t.fails(A, "select public.save_recipe($1, 2, $2::jsonb)", [pid, lines([{ ...spec, rate: "0.1" }])]))?.message).toMatch(/bruta/);
    expect((await t.fails(A, "select public.save_recipe($1, 2, $2::jsonb)", [pid, lines([spec, spec])]))?.message).toMatch(/ya está en la receta/);
    expect(await one(A, "select revision from products where id = $1", [pid])).toEqual({ revision: 2 });
  });

  it("las versiones son inmutables y conservan la mano de obra asignada", async () => {
    const { id: v2 } = await one<{ id: number }>(A, "select id from recipe_versions where product_id = $1 and number = 2", [pid]);
    expect((await t.fails(A, "update recipe_lines set quantity = 1 where recipe_id = $1", [v2]))?.code).toBe("P0001");
    await t.as(A, "insert into recipe_work (restaurant_id, recipe_id, operations) values ($1, $2, '[{\"employee_id\":1,\"activity\":\"Cortar\",\"minutes\":\"10\"}]')", [ra, v2]);
    await t.as(A, "select public.update_product($1, 2, 'Ceviche de la casa', 'Nuevo texto', 'Ceviches', 2)", [pid]);
    const v3 = await one(A, "select v.number, w.operations from recipe_versions v join recipe_work w on w.recipe_id = v.id where v.product_id = $1 order by v.number desc limit 1", [pid]);
    expect(v3).toMatchObject({ number: 3, operations: [{ activity: "Cortar" }] });
  });

  it("escalar multiplica cantidades y exige stock para el nuevo lote", async () => {
    // Sin compras de limón no hay stock: no se puede escalar.
    const e = await t.fails(A, "select public.scale_recipe($1, 3, 4)", [pid]);
    expect(e?.message).toMatch(/Insumos insuficientes.*Limón propio: se necesitan 0.625 kg, disponibles 0 kg/);
    await t.as(A, "select public.register_purchase($1, 2, 'unit:kg', 8, '2026-11-01', $2)", [limon, "a".repeat(32)]);
    await t.as(A, "select public.scale_recipe($1, 3, 4)", [pid]);
    const v4 = await one(A, "select v.output_quantity::text q, l.quantity::text lq from recipe_versions v join recipe_lines l on l.recipe_id = v.id where v.product_id = $1 and v.number = 4", [pid]);
    expect(v4).toEqual({ q: "4", lq: "500" });
  });

  it("solo se elimina un plato sin uso; el historial desaparece con él", async () => {
    await t.as(A, "select public.delete_product($1, 4)", [pid]);
    expect(await one(A, "select count(*)::int n from recipe_versions where product_id = $1", [pid])).toEqual({ n: 0 });
  });
});

describe("platos del catálogo", () => {
  it("personalizar copia insumos con su factor explícito y exige stock", async () => {
    const results: Record<number, string> = {};
    for (let dish = 1; dish <= 20; dish++) {
      const e = await t.fails(A, "select public.personalize_dish($1, $2)", [ra, dish]);
      results[dish] = e ? e.message : "ok";
    }
    const ok = Object.entries(results).filter(([, v]) => v === "ok").map(([k]) => Number(k));
    const failed = Object.entries(results).filter(([, v]) => v !== "ok");
    // Cada plato o se crea completo o falla por stock, sin dejar datos a medias.
    for (const [, message] of failed) expect(message).toMatch(/Insumos insuficientes/);
    const { n } = await one<{ n: number }>(A, "select count(*)::int n from products where source_key like 'catalogo:%'");
    expect(n).toBe(ok.length);
    // El stock de apertura del catálogo alcanza para un lote de cada uno de los 20 platos.
    expect(ok).toHaveLength(20);
    if (ok.length) {
      const line = await one<{ unit_key: string; ev: string }>(
        A,
        "select l.unit_key, l.conversion_evidence ev from products p join recipe_versions v on v.product_id = p.id join recipe_lines l on l.recipe_id = v.id where p.source_key = $1 limit 1",
        [`catalogo:${ok[0]}`],
      );
      expect(line.ev).toBe("Factor explícito de la receta del catálogo.");
      expect((await t.fails(A, "select public.personalize_dish($1, $2)", [ra, ok[0]]))?.message).toMatch(/Ya personalizaste/);
    }
  });
});

describe("aislamiento", () => {
  it("otro usuario no crea ni edita platos ajenos", async () => {
    expect((await t.fails(B, "select public.create_product($1, 'Intruso')", [ra]))?.code).toBe("42501");
    const { id } = await one<{ id: number }>(A, "select public.create_product($1, 'Plato privado') id", [ra]);
    expect((await t.fails(B, "select public.save_recipe($1, 1, '[]'::jsonb)", [id]))?.code).toBe("42501");
    expect((await t.fails(B, "select public.delete_product($1, 1)", [id]))?.code).toBe("42501");
    expect(await t.as(B, "select id from products where id = $1", [id])).toEqual([]);
  });
});
