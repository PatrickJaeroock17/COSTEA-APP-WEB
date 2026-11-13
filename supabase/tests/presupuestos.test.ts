// Fase 12: publicar presupuestos (huella vigente, versiones, inmutabilidad, salidas del kardex con stock,
// archivo y aislamiento). Equivale a los casos de publicación de test_planning.py y test_inventory.py.
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, uid } from "./db";

const A = uid(61);
const B = uid(62);
let t: Awaited<ReturnType<typeof createDb>>;
let ra: string;
let plan: number;
let limon: number;
const H1 = "a".repeat(64);
const H2 = "b".repeat(64);

const one = async <T = Record<string, unknown>>(u: string, sql: string, params: unknown[] = []) => (await t.as<T>(u, sql, params))[0];
const publish = (u: string, hash: string, snapshot = { input: {}, result: { ok: true } }) =>
  t.as<{ id: number }>(u, "select public.publish_budget($1, $2, $3::jsonb) id", [plan, hash, JSON.stringify(snapshot)]);

beforeAll(async () => {
  t = await createDb();
  await t.signUp(A, { name: "Ana", restaurant: "El Puerto" });
  await t.signUp(B, { name: "Beto", restaurant: "Otro" });
  ({ id: ra } = await one<{ id: string }>(A, "select id from restaurants"));
  const { id: period } = await one<{ id: number }>(A, "select id from periods where restaurant_id = $1", [ra]);
  ({ id: limon } = await one<{ id: number }>(A, "select public.create_material($1, 'Limón propio', null, 'Frutas', 'kg', 8, '2026-11-01') id", [ra]));
  const { id: cost } = await one<{ id: number }>(A, "select id from material_cost_versions where material_id = $1", [limon]);
  const { id: product } = await one<{ id: number }>(A, "select public.create_product($1, 'Limonada', null, null, 1) id", [ra]);
  // 100 g de limón por porción con 20 % de merma → 0.125 kg brutos por porción.
  await t.as(A, "select public.save_recipe($1, 1, $2::jsonb)", [product, JSON.stringify([{ material_id: limon, cost_version_id: cost, quantity: "100", unit_key: "unit:g", mode: "loss", rate: "0.2" }])]);
  ({ id: plan } = await one<{ id: number }>(A, "select public.create_plan($1, $2, 'Plan', '2026-11-30', true, true, $3::jsonb) id", [
    ra,
    period,
    JSON.stringify([{ product_id: product, quantity: "40", price: "10", factor: "1" }]),
  ]));
}, 60_000);

describe("publicar", () => {
  it("exige la huella revisada vigente", async () => {
    expect((await t.fails(A, "select public.publish_budget($1, $2, '{}'::jsonb)", [plan, H1]))?.message).toMatch(/cambiaron las entradas/);
    await t.db.query("update production_plans set calculation_hash = $1 where id = $2", [H1, plan]);
    expect((await t.fails(A, "select public.publish_budget($1, $2, '{}'::jsonb)", [plan, H2]))?.message).toMatch(/cambiaron las entradas/);
  });

  it("sin stock no publica nada (todo o nada)", async () => {
    const e = await t.fails(A, "select public.publish_budget($1, $2, '{}'::jsonb)", [plan, H1]);
    expect(e?.message).toMatch(/insumos insuficientes.*Limón propio: se necesitan 5 kg, disponibles 0 kg/);
    expect(JSON.parse(e!.detail!)).toEqual([{ name: "Limón propio", unit: "kg", needed: "5", available: "0" }]);
    expect(await one(A, "select count(*)::int n from budgets where plan_id = $1", [plan])).toEqual({ n: 0 });
  });

  it("con stock crea la versión 1 y registra las salidas del kardex una sola vez", async () => {
    await t.as(A, "select public.register_purchase($1, 6, 'unit:kg', 8, '2026-11-01', $2)", [limon, "c".repeat(32)]);
    const [{ id }] = await publish(A, H1);
    expect(await one(A, "select number, fingerprint from budgets where id = $1", [id])).toEqual({ number: 1, fingerprint: H1 });
    expect(await t.as(A, "select quantity::text q, movement_on::text d, reference from inventory_movements where plan_id = $1", [plan])).toEqual([
      { q: "5", d: "2026-11-30", reference: `Plan de producción #${plan}` },
    ]);
    // Misma huella: no duplica presupuesto ni salidas.
    const [{ id: again }] = await publish(A, H1);
    expect(again).toBe(id);
    expect(await one(A, "select count(*)::int n from inventory_movements where plan_id = $1", [plan])).toEqual({ n: 1 });
  });

  it("con otra huella crea la versión siguiente", async () => {
    await t.db.query("update production_plans set calculation_hash = $1 where id = $2", [H2, plan]);
    const [{ id }] = await publish(A, H2);
    expect(await one(A, "select number from budgets where id = $1", [id])).toEqual({ number: 2 });
  });

  it("el presupuesto es inmutable; archivar solo lo oculta", async () => {
    const { id } = await one<{ id: number }>(A, "select id from budgets where plan_id = $1 and number = 1", [plan]);
    expect((await t.fails(A, "update budgets set snapshot = '{}' where id = $1", [id]))?.code).toBe("P0001");
    expect((await t.fails(A, "delete from budgets where id = $1", [id]))?.code).toBe("P0001");
    await t.as(A, "insert into budget_archives (budget_id, restaurant_id, archived) values ($1, $2, true) on conflict (budget_id) do update set archived = excluded.archived", [id, ra]);
    expect(await one(A, "select archived from budget_archives where budget_id = $1", [id])).toEqual({ archived: true });
  });

  it("otro usuario no publica ni ve presupuestos ajenos", async () => {
    expect((await t.fails(B, "select public.publish_budget($1, $2, '{}'::jsonb)", [plan, H2]))?.code).toBe("42501");
    expect(await t.as(B, "select id from budgets where restaurant_id = $1", [ra])).toEqual([]);
  });
});
