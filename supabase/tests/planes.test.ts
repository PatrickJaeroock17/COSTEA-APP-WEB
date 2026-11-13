// Fase 10: plan del mes (creación atómica, líneas, modalidades de precio, activo único y aislamiento).
// Equivale a los casos con base de datos de test_planning.py y test_production_table.py (creación).
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, uid } from "./db";

const A = uid(51);
const B = uid(52);
let t: Awaited<ReturnType<typeof createDb>>;
let ra: string;
let period: number;
let ceviche: number;
let causa: number;

const one = async <T = Record<string, unknown>>(u: string, sql: string, params: unknown[] = []) => (await t.as<T>(u, sql, params))[0];
const create = (u: string, lines: object[], name = "Plan de noviembre") =>
  t.as<{ id: number }>(u, "select public.create_plan($1, $2, $3, '2026-11-30', false, false, $4::jsonb) id", [ra, period, name, JSON.stringify(lines)]);

beforeAll(async () => {
  t = await createDb();
  await t.signUp(A, { name: "Ana", restaurant: "El Puerto" });
  await t.signUp(B, { name: "Beto", restaurant: "Otro" });
  ({ id: ra } = await one<{ id: string }>(A, "select id from restaurants"));
  ({ id: period } = await one<{ id: number }>(A, "select id from periods where restaurant_id = $1", [ra]));
  ({ id: ceviche } = await one<{ id: number }>(A, "select public.create_product($1, 'Ceviche') id", [ra]));
  ({ id: causa } = await one<{ id: number }>(A, "select public.create_product($1, 'Causa') id", [ra]));
}, 60_000);

describe("crear el plan del mes", () => {
  let plan: number;

  it("crea plan y líneas en una sola operación; el primero queda activo", async () => {
    [{ id: plan }] = await create(A, [{ product_id: ceviche, quantity: "800", price: "17.70", factor: "1" }]);
    const line = await one(A, "select pl.active, l.quantity::text q, l.reference_price::text ref, l.pricing_mode, l.pricing_value::text v, l.tax_rate::text tax from production_plans pl join plan_lines l on l.plan_id = pl.id where pl.id = $1", [plan]);
    expect(line).toEqual({ active: true, q: "800", ref: "15", pricing_mode: "manual", v: "17.70", tax: "0.180000" });
  });

  it("valida cantidades, precio y factor sin dejar el plan a medias", async () => {
    const e = await t.fails(A, "select public.create_plan($1, $2, 'Malo', '2026-11-30', false, false, $3::jsonb)", [ra, period, JSON.stringify([{ product_id: causa, quantity: "0", price: "", factor: "1" }])]);
    expect(e?.message).toMatch(/Causa: indica cantidad mensual.*Causa: indica precio final/);
    expect(await one(A, "select count(*)::int n from production_plans where restaurant_id = $1", [ra])).toEqual({ n: 1 });
  });

  it("un segundo plan del mes no queda activo hasta activarlo", async () => {
    const [{ id: other }] = await create(A, [], "Escenario alto");
    expect(await one(A, "select active from production_plans where id = $1", [other])).toEqual({ active: false });
    await t.as(A, "select public.activate_plan($1)", [other]);
    expect(await t.as(A, "select id from production_plans where restaurant_id = $1 and active", [ra])).toEqual([{ id: other }]);
    await t.as(A, "select public.activate_plan($1)", [plan]);
  });

  it("líneas: agrega, edita modalidad, valida límites y quita", async () => {
    await t.as(A, "select public.save_plan_line($1, $2, 100, 20, 1, 'food_cost', 0.3, null)", [plan, causa]);
    expect(await one(A, "select pricing_mode, pricing_value::text v from plan_lines where plan_id = $1 and product_id = $2", [plan, causa])).toEqual({ pricing_mode: "food_cost", v: "0.3" });
    expect((await t.fails(A, "select public.save_plan_line($1, $2, 100, 20, 1, 'food_cost', 1.01, null)", [plan, causa]))?.message).toMatch(/food cost/);
    expect((await t.fails(A, "select public.save_plan_line($1, $2, 100, 20, 1, 'margin', 1, null)", [plan, causa]))?.message).toMatch(/margen/);
    expect((await t.fails(A, "select public.save_plan_line($1, $2, 100, 20, 0, 'markup', 0.2, null)", [plan, causa]))?.message).toMatch(/factor/);
    const { id: line } = await one<{ id: number }>(A, "select id from plan_lines where plan_id = $1 and product_id = $2", [plan, causa]);
    await t.as(A, "select public.remove_plan_line($1)", [line]);
    expect(await one(A, "select count(*)::int n from plan_lines where plan_id = $1", [plan])).toEqual({ n: 1 });
  });

  it("la línea conserva su versión de receta hasta pedir la vigente", async () => {
    await t.as(A, "select public.update_product($1, 1, 'Ceviche', 'Nueva descripción', null, 1)", [ceviche]);
    const before = await one<{ recipe_id: number }>(A, "select recipe_id from plan_lines where plan_id = $1 and product_id = $2", [plan, ceviche]);
    await t.as(A, "select public.save_plan_line($1, $2, 800, 15, 1, 'manual', 17.70, null)", [plan, ceviche]);
    expect(await one(A, "select recipe_id from plan_lines where plan_id = $1 and product_id = $2", [plan, ceviche])).toEqual(before);
    await t.as(A, "select public.save_plan_line($1, $2, 800, 15, 1, 'manual', 17.70, null, true)", [plan, ceviche]);
    const after = await one<{ number: number }>(A, "select v.number from plan_lines l join recipe_versions v on v.id = l.recipe_id where l.plan_id = $1 and l.product_id = $2", [plan, ceviche]);
    expect(after.number).toBe(2);
  });

  it("otro usuario no ve ni edita planes ajenos", async () => {
    expect(await t.as(B, "select id from production_plans where restaurant_id = $1", [ra])).toEqual([]);
    expect((await t.fails(B, "select public.save_plan_line($1, $2, 1, 1, 1, 'manual', 1, null)", [plan, ceviche]))?.code).toBe("42501");
    expect((await t.fails(B, "select public.activate_plan($1)", [plan]))?.code).toBe("42501");
  });
});
