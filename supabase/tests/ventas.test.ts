// Fase 13: ventas (requisitos, precio y costo congelados, salidas del kardex con stock, anulación y aislamiento).
// Equivale a los casos con base de datos de test_sales.py y test_inventory.py.
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, uid } from "./db";

const A = uid(71);
const B = uid(72);
let t: Awaited<ReturnType<typeof createDb>>;
let ra: string;
let period: number;
let product: number;
let limon: number;

const one = async <T = Record<string, unknown>>(u: string, sql: string, params: unknown[] = []) => (await t.as<T>(u, sql, params))[0];
const sell = (u: string, quantity: string, day = "2026-11-10") =>
  t.fails(u, "select public.register_sale($1, $2, $3, $4, 5)", [period, product, day, quantity]);

beforeAll(async () => {
  t = await createDb();
  await t.signUp(A, { name: "Ana", restaurant: "El Puerto" });
  await t.signUp(B, { name: "Beto", restaurant: "Otro" });
  ({ id: ra } = await one<{ id: string }>(A, "select id from restaurants"));
  await t.db.query("update periods set year = 2026, month = 11 where restaurant_id = $1", [ra]);
  ({ id: period } = await one<{ id: number }>(A, "select id from periods where restaurant_id = $1", [ra]));
  ({ id: limon } = await one<{ id: number }>(A, "select public.create_material($1, 'Limón propio', null, 'Frutas', 'kg', 8, '2026-11-01') id", [ra]));
  const { id: cost } = await one<{ id: number }>(A, "select id from material_cost_versions where material_id = $1", [limon]);
  ({ id: product } = await one<{ id: number }>(A, "select public.create_product($1, 'Limonada', null, null, 1) id", [ra]));
  // 250 g por porción.
  await t.as(A, "select public.save_recipe($1, 1, $2::jsonb)", [product, JSON.stringify([{ material_id: limon, cost_version_id: cost, quantity: "250", unit_key: "unit:g", mode: "gross", rate: "0" }])]);
}, 60_000);

describe("registrar ventas", () => {
  it("exige precio de carta", async () => {
    expect((await sell(A, "1"))?.message).toMatch(/precio de carta/);
    await t.as(A, "insert into product_prices (product_id, restaurant_id, amount) values ($1, $2, 11.80)", [product, ra]);
  });

  it("exige fecha dentro del mes de trabajo y cantidad positiva", async () => {
    expect((await sell(A, "1", "2026-12-01"))?.message).toMatch(/mes de trabajo/);
    expect((await sell(A, "0"))?.message).toMatch(/mayor que cero/);
  });

  it("sin stock no registra la venta", async () => {
    expect((await sell(A, "18"))?.message).toMatch(/Insumos insuficientes.*Limón propio: se necesitan 4.5 kg, disponibles 0 kg/);
    expect(await one(A, "select count(*)::int n from sales where restaurant_id = $1", [ra])).toEqual({ n: 0 });
  });

  it("con stock congela precio y costo y descuenta el kardex (250 g × 18 = 4.5 kg)", async () => {
    await t.as(A, "select public.register_purchase($1, 10, 'unit:kg', 8, '2026-11-01', $2)", [limon, "d".repeat(32)]);
    expect(await sell(A, "18")).toBeNull();
    const sale = await one<{ id: number; unit_price: string; unit_cost: string }>(A, "select id, unit_price::text, unit_cost::text from sales where restaurant_id = $1", [ra]);
    expect(sale).toMatchObject({ unit_price: "11.80", unit_cost: "5" });
    expect(await t.as(A, "select quantity::text q, kind, voided from inventory_movements where sale_id = $1", [sale.id])).toEqual([{ q: "4.5", kind: "out", voided: false }]);
    // El precio de carta posterior no cambia la venta.
    await t.as(A, "update product_prices set amount = 20 where product_id = $1", [product]);
    expect(await one(A, "select unit_price::text p from sales where id = $1", [sale.id])).toEqual({ p: "11.80" });
  });

  it("una venta anterior respeta lo ya comprometido después (10 kg − 4.5 kg)", async () => {
    expect((await sell(A, "23", "2026-11-05"))?.message).toMatch(/disponibles 5.5 kg/);
  });

  it("eliminar anula las salidas y devuelve el stock", async () => {
    const { id } = await one<{ id: number }>(A, "select id from sales where restaurant_id = $1", [ra]);
    await t.as(A, "select public.delete_sale($1)", [id]);
    expect(await one(A, "select count(*)::int n from sales where restaurant_id = $1", [ra])).toEqual({ n: 0 });
    expect(await t.as(A, "select voided, sale_id from inventory_movements where material_id = $1 and kind = 'out'", [limon])).toEqual([{ voided: true, sale_id: null }]);
    expect(await one(A, "select public.material_available($1, '2026-11-30')::text a", [limon])).toEqual({ a: "10" });
  });

  it("otro usuario no registra, ve ni elimina ventas ajenas", async () => {
    expect((await sell(B, "1"))?.code).toBe("42501");
    expect(await sell(A, "1")).toBeNull();
    const { id } = await one<{ id: number }>(A, "select id from sales where restaurant_id = $1", [ra]);
    expect(await t.as(B, "select id from sales where restaurant_id = $1", [ra])).toEqual([]);
    expect((await t.fails(B, "select public.delete_sale($1)", [id]))?.code).toBe("42501");
  });
});
