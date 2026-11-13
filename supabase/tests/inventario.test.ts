// Fase 14: inventario (entradas manuales, compras guardadas, apertura y aislamiento).
// Equivale a los casos con base de datos de test_inventory.py y test_restaurant_flow.py (apertura).
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, uid } from "./db";

const A = uid(81);
const B = uid(82);
let t: Awaited<ReturnType<typeof createDb>>;
let ra: string;
let papa: number;

const one = async <T = Record<string, unknown>>(u: string, sql: string, params: unknown[] = []) => (await t.as<T>(u, sql, params))[0];

beforeAll(async () => {
  t = await createDb();
  await t.signUp(A, { name: "Ana", restaurant: "El Puerto" });
  await t.signUp(B, { name: "Beto", restaurant: "Otro" });
  ({ id: ra } = await one<{ id: string }>(A, "select id from restaurants"));
  ({ id: papa } = await one<{ id: number }>(A, "select public.create_material($1, 'Papa propia', 'Amarilla', 'Verduras', 'kg', 3, '2026-11-01') id", [ra]));
}, 60_000);

describe("entradas manuales", () => {
  it("registra con referencia normalizada y no duplica", async () => {
    await t.as(A, "select public.register_receipt($1, '2026-11-02', 10, 3.5, '  F001-123   Mercado ')", [papa]);
    expect(await one(A, "select reference, quantity::text q, unit_cost::text c from inventory_movements where material_id = $1", [papa])).toEqual({
      reference: "f001-123 mercado",
      q: "10",
      c: "3.5",
    });
    expect((await t.fails(A, "select public.register_receipt($1, '2026-11-03', 1, 1, 'f001-123 MERCADO')", [papa]))?.message).toMatch(/ya está registrada/);
  });

  it("valida cantidad, costo y referencia", async () => {
    expect(await t.fails(A, "select public.register_receipt($1, '2026-11-02', 0, 1, 'x')", [papa])).not.toBeNull();
    expect(await t.fails(A, "select public.register_receipt($1, '2026-11-02', 1, -1, 'y')", [papa])).not.toBeNull();
    expect(await t.fails(A, "select public.register_receipt($1, '2026-11-02', 1, 1, '  ')", [papa])).not.toBeNull();
  });
});

describe("compras con comprobante guardadas", () => {
  it("se incorporan una sola vez con cantidad en unidad base y costo unitario", async () => {
    // 2 sacos de 25 kg, neto 120 + 6 de flete; IGV recuperable fuera del costo.
    const { id } = await one<{ id: number }>(
      A,
      "insert into material_cost_versions (restaurant_id, material_id, effective_on, mode, source, currency, quantity, purchase_unit, factor, conversion_evidence, net_amount, nonrecoverable_tax, recoverable_tax, attributable_cost) values ($1, $2, '2026-11-05', 'purchase', 'F002-9', 'PEN', 2, 'Saco 25 kg', 25, 'Etiqueta', 120, 0, 21.6, 6) returning id",
      [ra, papa],
    );
    const { id: mv } = await one<{ id: number }>(A, "select public.import_saved_purchase($1) id", [id]);
    expect(await one(A, "select quantity::text q, unit_cost::text c, movement_on::text d, reference from inventory_movements where id = $1", [mv])).toEqual({
      q: "50",
      c: "2.52",
      d: "2026-11-05",
      reference: `Compra guardada #${id}`,
    });
    expect(await one(A, "select public.import_saved_purchase($1) id", [id])).toEqual({ id: mv });
  });
});

describe("apertura y aislamiento", () => {
  it("volver a pedir la apertura no repone ni duplica", async () => {
    const before = await one<{ n: number }>(A, "select count(*)::int n from inventory_movements where restaurant_id = $1", [ra]);
    expect(await one(A, "select public.seed_catalog_opening($1) n", [ra])).toEqual({ n: 0 });
    expect(await one(A, "select count(*)::int n from inventory_movements where restaurant_id = $1", [ra])).toEqual(before);
  });

  it("otro usuario no registra entradas ni pide la apertura de otro restaurante", async () => {
    expect((await t.fails(B, "select public.register_receipt($1, '2026-11-02', 1, 1, 'intruso')", [papa]))?.code).toBe("42501");
    expect((await t.fails(B, "select public.seed_catalog_opening($1)", [ra]))?.code).toBe("42501");
    expect(await t.as(B, "select id from inventory_movements where restaurant_id = $1", [ra])).toEqual([]);
  });
});
