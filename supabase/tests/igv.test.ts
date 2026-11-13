// IGV configurable por restaurante: tasa por defecto, validación, planes con la tasa del restaurante,
// revisión invalidada al cambiarla y ventas con su tasa congelada.
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, uid } from "./db";

const A = uid(91);
let t: Awaited<ReturnType<typeof createDb>>;
let ra: string;
let period: number;
let product: number;
let limon: number;

const one = async <T = Record<string, unknown>>(u: string, sql: string, params: unknown[] = []) => (await t.as<T>(u, sql, params))[0];

beforeAll(async () => {
  t = await createDb();
  await t.signUp(A, { name: "Ana", restaurant: "El Puerto" });
  ({ id: ra } = await one<{ id: string }>(A, "select id from restaurants"));
  await t.db.query("update periods set year = 2026, month = 11 where restaurant_id = $1", [ra]);
  ({ id: period } = await one<{ id: number }>(A, "select id from periods where restaurant_id = $1", [ra]));
  ({ id: limon } = await one<{ id: number }>(A, "select public.create_material($1, 'Limón propio', null, 'Frutas', 'kg', 8, '2026-11-01') id", [ra]));
  const { id: cost } = await one<{ id: number }>(A, "select id from material_cost_versions where material_id = $1", [limon]);
  ({ id: product } = await one<{ id: number }>(A, "select public.create_product($1, 'Limonada', null, null, 1) id", [ra]));
  await t.as(A, "select public.save_recipe($1, 1, $2::jsonb)", [product, JSON.stringify([{ material_id: limon, cost_version_id: cost, quantity: "100", unit_key: "unit:g", mode: "gross", rate: "0" }])]);
  await t.as(A, "insert into product_prices (product_id, restaurant_id, amount) values ($1, $2, 11.80)", [product, ra]);
  await t.as(A, "select public.register_purchase($1, 10, 'unit:kg', 8, '2026-11-01', $2)", [limon, "e".repeat(32)]);
}, 60_000);

describe("tasa del restaurante", () => {
  it("por defecto es 18 % y se valida entre 0 y 30 %", async () => {
    expect(await one(A, "select igv_rate::text r from restaurants where id = $1", [ra])).toEqual({ r: "0.180000" });
    expect((await t.fails(A, "update restaurants set igv_rate = 0.31 where id = $1", [ra]))?.code).toBe("23514");
  });

  it("un restaurante al 18 % crea el plan con venta de referencia = precio ÷ 1.18", async () => {
    const { id } = await one<{ id: number }>(A, "select public.create_plan($1, $2, 'Plan 18', '2026-11-30', true, true, $3::jsonb) id", [
      ra,
      period,
      JSON.stringify([{ product_id: product, quantity: "10", price: "11.80", factor: "1" }]),
    ]);
    expect(await one(A, "select reference_price::text ref, tax_rate::text tax from plan_lines where plan_id = $1", [id])).toEqual({ ref: "10", tax: "0.180000" });
  });
});

describe("cambio de tasa", () => {
  let plan: number;
  let oldSale: number;

  beforeAll(async () => {
    ({ id: plan } = await one<{ id: number }>(A, "select id from production_plans where restaurant_id = $1", [ra]));
    await t.db.query("update production_plans set calculation_hash = $1 where id = $2", ["f".repeat(64), plan]);
    await t.as(A, "select public.register_sale($1, $2, '2026-11-10', 1, 0.8)", [period, product]);
    ({ id: oldSale } = await one<{ id: number }>(A, "select id from sales where restaurant_id = $1", [ra]));
    await t.as(A, "update restaurants set igv_rate = 0.10 where id = $1", [ra]);
  });

  it("los planes pierden el cálculo revisado y sus líneas toman la nueva tasa", async () => {
    expect(await one(A, "select calculation_hash from production_plans where id = $1", [plan])).toEqual({ calculation_hash: null });
    expect(await one(A, "select tax_rate::text tax from plan_lines where plan_id = $1", [plan])).toEqual({ tax: "0.100000" });
  });

  it("la venta antigua conserva su 18 % y la nueva se congela al 10 %", async () => {
    await t.as(A, "select public.register_sale($1, $2, '2026-11-11', 1, 0.8)", [period, product]);
    const rates = await t.as<{ id: number; r: string }>(A, "select id, igv_rate::text r from sales where restaurant_id = $1 order by id", [ra]);
    expect(rates).toEqual([
      { id: oldSale, r: "0.180000" },
      { id: rates[1].id, r: "0.100000" },
    ]);
  });

  it("un plan nuevo al 10 % usa precio ÷ 1.10 (ceviche del Excel UNI: 45.13 → 41.0273)", async () => {
    const { id } = await one<{ id: number }>(A, "select public.create_plan($1, $2, 'Plan 10', '2026-11-30', true, true, $3::jsonb) id", [
      ra,
      period,
      JSON.stringify([{ product_id: product, quantity: "10", price: "45.13", factor: "1" }]),
    ]);
    const line = await one<{ ref: string; tax: string }>(A, "select reference_price::text ref, tax_rate::text tax from plan_lines where plan_id = $1", [id]);
    expect(line.tax).toBe("0.100000");
    expect(line.ref.startsWith("41.0272727")).toBe(true);
  });
});
