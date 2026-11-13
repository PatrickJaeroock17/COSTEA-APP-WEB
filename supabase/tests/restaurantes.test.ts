// Fase 5: restaurantes, periodos y unidades sobre el esquema real (migraciones) con RLS.
// Equivale a los casos con base de datos de legacy/Costea-main/costos_app/tests/test_companies.py.
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, uid } from "./db";

const A = uid(1);
const B = uid(2);
let t: Awaited<ReturnType<typeof createDb>>;
let ra: string;
let rb: string;

beforeAll(async () => {
  t = await createDb();
  await t.signUp(A, { name: "Ana", restaurant: "El Puerto" });
  await t.signUp(B, { name: "Beto" });
  [{ id: ra }] = await t.as<{ id: string }>(A, "select id from restaurants");
  [{ id: rb }] = await t.as<{ id: string }>(B, "select public.create_restaurant('Pollería Don Beto SAC', 'Don Beto', 'peru_ruc', '20123456789', 'USD', 2026, 9) id");
}, 60_000);

describe("alta de restaurantes", () => {
  it("el registro crea perfil, restaurante y el mes actual", async () => {
    const rows = await t.as<{ n: number; role: string }>(
      A,
      "select (select count(*) from periods where restaurant_id = $1)::int n, (select role from restaurant_members where restaurant_id = $1) role",
      [ra],
    );
    expect(rows[0]).toEqual({ n: 1, role: "owner" });
  });

  it("create_restaurant crea el primer mes con IGV 18 %", async () => {
    const rows = await t.as(B, "select year, month, tax_rate::text tax from periods where restaurant_id = $1", [rb]);
    expect(rows).toEqual([{ year: 2026, month: 9, tax: "0.180000" }]);
  });

  it("valida RUC, razón social y mes sin dejar datos a medias", async () => {
    expect((await t.fails(B, "select public.create_restaurant('Otro', null, 'peru_ruc', '20123456789')"))?.code).toBe("23505");
    expect((await t.fails(B, "select public.create_restaurant('Otro', null, 'peru_ruc', '123')"))?.code).toBe("23514");
    expect((await t.fails(B, "select public.create_restaurant('X')"))?.code).toBe("23514");
    expect((await t.fails(B, "select public.create_restaurant('Ok SAC', null, 'peru_ruc', null, 'PEN', 2026, 13)"))?.code).toBe("23514");
    expect(await t.as(B, "select count(*)::int n from restaurants")).toEqual([{ n: 1 }]);
  });

  it("otro dueño puede usar el mismo RUC", async () => {
    const [row] = await t.as<{ id: string }>(A, "select public.create_restaurant('Pollería A', null, 'peru_ruc', '20123456789') id");
    expect(row.id).toBeTruthy();
  });
});

describe("aislamiento por restaurante (RLS)", () => {
  it("un usuario no ve ni modifica restaurantes ajenos", async () => {
    expect(await t.as(A, "select id from restaurants where id = $1", [rb])).toEqual([]);
    expect(await t.as(A, "select id from periods where restaurant_id = $1", [rb])).toEqual([]);
    expect(await t.as(A, "update restaurants set legal_name = 'Hackeado' where id = $1 returning id", [rb])).toEqual([]);
    expect(await t.fails(A, "insert into periods (restaurant_id, year, month) values ($1, 2026, 10)", [rb])).not.toBeNull();
    expect(await t.fails(A, "insert into restaurant_units (restaurant_id, unit_code) values ($1, 'kg')", [rb])).not.toBeNull();
    expect(await t.as(A, "select public.restaurant_money_data($1) v", [rb])).toEqual([{ v: false }]);
  });
});

describe("periodos, moneda, archivo y unidades", () => {
  it("no admite meses duplicados", async () => {
    const e = await t.fails(B, "insert into periods (restaurant_id, year, month, tax_rate) values ($1, 2026, 9, 0.18)", [rb]);
    expect(e?.code).toBe("23505");
  });

  it("la moneda se bloquea al registrar importes y el dueño es inmutable", async () => {
    const [changed] = await t.as<{ currency: string; owner_id: string }>(
      B,
      "update restaurants set currency = 'PEN', owner_id = $2 where id = $1 returning currency, owner_id",
      [rb, A],
    );
    expect(changed).toEqual({ currency: "PEN", owner_id: B });
    await t.as(B, "update restaurants set currency = 'USD' where id = $1", [rb]);
    const [{ id: period }] = await t.as<{ id: number }>(B, "select id from periods where restaurant_id = $1", [rb]);
    await t.as(
      B,
      "insert into cost_concepts (restaurant_id, period_id, name, kind, amount, basis, behavior, justification) values ($1, $2, 'Luz', 'cif', 100, 'equivalent', 'fixed', 'Prueba')",
      [rb, period],
    );
    expect(await t.as(B, "select public.restaurant_money_data($1) v", [rb])).toEqual([{ v: true }]);
    expect((await t.fails(B, "update restaurants set currency = 'PEN' where id = $1", [rb]))?.code).toBe("P0001");
  });

  it("archivar y restaurar conserva el restaurante", async () => {
    expect(await t.as(B, "update restaurants set active = false where id = $1 returning active", [rb])).toEqual([{ active: false }]);
    expect(await t.as(B, "update restaurants set active = true where id = $1 returning active", [rb])).toEqual([{ active: true }]);
  });

  it("guarda las unidades habilitadas", async () => {
    const rows = await t.as(
      B,
      "insert into restaurant_units (restaurant_id, unit_code, enabled) select $1, code, code in ('kg', 'g') from units on conflict (restaurant_id, unit_code) do update set enabled = excluded.enabled returning unit_code",
      [rb],
    );
    expect(rows).toHaveLength(10);
    expect(await t.as(B, "select count(*)::int n from restaurant_units where restaurant_id = $1 and enabled", [rb])).toEqual([{ n: 2 }]);
  });
});
