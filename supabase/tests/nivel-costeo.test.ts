// Nivel de costeo por restaurante: valor por defecto, cambio por miembros con permiso, validación y migración de existentes.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, uid } from "./db";

const A = uid(95);
const B = uid(96);
let t: Awaited<ReturnType<typeof createDb>>;
let ra: string;
let rb: string;

const level = async (u: string, rid: string) => (await t.as<{ l: number }>(u, "select cost_level::int l from restaurants where id = $1", [rid]))[0].l;

beforeAll(async () => {
  t = await createDb();
  await t.signUp(A, { name: "Ana", restaurant: "El Puerto" });
  await t.signUp(B, { name: "Beto", restaurant: "Don Beto" });
  [{ id: ra }] = await t.as<{ id: string }>(A, "select id from restaurants");
  [{ id: rb }] = await t.as<{ id: string }>(B, "select id from restaurants");
}, 60_000);

describe("nivel de costeo", () => {
  it("un restaurante nuevo empieza en el nivel 1 y su primer mes se crea solo", async () => {
    expect(await level(A, ra)).toBe(1);
    expect((await t.as<{ n: number }>(A, "select count(*)::int n from periods where restaurant_id = $1", [ra]))[0].n).toBe(1);
  });

  it("el dueño sube y baja el nivel, y la base rechaza valores fuera de 1–3", async () => {
    await t.as(A, "select public.set_cost_level($1, 3::smallint)", [ra]);
    expect(await level(A, ra)).toBe(3);
    await t.as(A, "select public.set_cost_level($1, 2::smallint)", [ra]);
    expect(await level(A, ra)).toBe(2);
    expect((await t.fails(A, "select public.set_cost_level($1, 4::smallint)", [ra]))?.code).toBe("P0001");
    expect((await t.fails(A, "select public.set_cost_level($1, 0::smallint)", [ra]))?.code).toBe("P0001");
  });

  it("nadie cambia el nivel de un restaurante ajeno", async () => {
    expect((await t.fails(B, "select public.set_cost_level($1, 3::smallint)", [ra]))?.code).toBe("42501");
    expect(await level(A, ra)).toBe(2);
    expect(await level(B, rb)).toBe(1);
  });

  it("un lector (viewer) no puede cambiarlo", async () => {
    await t.db.query("insert into restaurant_members (restaurant_id, user_id, role) values ($1, $2, 'viewer')", [ra, B]);
    expect((await t.fails(B, "select public.set_cost_level($1, 3::smallint)", [ra]))?.code).toBe("42501");
  });
});

describe("migración de restaurantes existentes", () => {
  it("pasa a 3 los que ya tienen gastos, personal, planes o ventas y deja en 1 los vacíos", async () => {
    // Base con todas las migraciones menos la nueva, datos "antiguos" y luego se aplica la nueva.
    const files = readdirSync(join(process.cwd(), "supabase", "migrations")).sort();
    const target = files.find((f) => f.includes("nivel_costeo"))!;
    const db = new PGlite();
    await db.exec(`
      create role anon nologin; create role authenticated nologin; create role service_role nologin;
      create schema auth; create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    `);
    for (const f of files.filter((f) => f < target)) await db.exec(readFileSync(join(process.cwd(), "supabase", "migrations", f), "utf8").replace(/^﻿/, ""));
    const u1 = uid(97);
    const u2 = uid(98);
    for (const [u, n] of [[u1, "Con gastos"], [u2, "Vacío"]] as const) {
      await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [u, `${n}@x.pe`, { name: n, restaurant: n }]);
    }
    const rows = (await db.query<{ id: string; legal_name: string }>("select id, legal_name from restaurants")).rows;
    const conGastos = rows.find((r) => r.legal_name === "Con gastos")!.id;
    const period = (await db.query<{ id: number }>("select id from periods where restaurant_id = $1", [conGastos])).rows[0].id;
    await db.query(
      "insert into cost_concepts (restaurant_id, period_id, name, kind, amount, basis, behavior, justification) values ($1, $2, 'Gas', 'cif', 100, 'equivalent', 'fixed', 'prueba')",
      [conGastos, period],
    );
    await db.exec(readFileSync(join(process.cwd(), "supabase", "migrations", target), "utf8").replace(/^﻿/, ""));
    const after = (await db.query<{ legal_name: string; l: number }>("select legal_name, cost_level::int l from restaurants order by legal_name")).rows;
    expect(after).toEqual([{ legal_name: "Con gastos", l: 3 }, { legal_name: "Vacío", l: 1 }]);
  }, 60_000);
});
