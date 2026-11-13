// Fase 9: gastos (valores válidos, duplicados por mes, destinatarios del restaurante y aislamiento).
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, uid } from "./db";

const A = uid(41);
const B = uid(42);
let t: Awaited<ReturnType<typeof createDb>>;
let ra: string;
let rb: string;
let period: number;
let dish: number;
let foreignDish: number;

const one = async <T = Record<string, unknown>>(u: string, sql: string, params: unknown[] = []) => (await t.as<T>(u, sql, params))[0];
const insert = (u: string, params: unknown[]) =>
  t.fails(
    u,
    "insert into cost_concepts (restaurant_id, period_id, name, reference_key, kind, amount, basis, behavior, justification, targets) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)",
    params,
  );

beforeAll(async () => {
  t = await createDb();
  await t.signUp(A, { name: "Ana", restaurant: "El Puerto" });
  await t.signUp(B, { name: "Beto", restaurant: "Otro" });
  ({ id: ra } = await one<{ id: string }>(A, "select id from restaurants"));
  ({ id: rb } = await one<{ id: string }>(B, "select id from restaurants"));
  ({ id: period } = await one<{ id: number }>(A, "select id from periods where restaurant_id = $1", [ra]));
  ({ id: dish } = await one<{ id: number }>(A, "select public.create_product($1, 'Ceviche') id", [ra]));
  ({ id: foreignDish } = await one<{ id: number }>(B, "select public.create_product($1, 'Ajeno') id", [rb]));
}, 60_000);

describe("conceptos de gasto", () => {
  it("guarda un gasto válido con destinatarios del restaurante", async () => {
    expect(await insert(A, [ra, period, "Luz y agua", "luz y agua", "cif", "800", "equivalent", "fixed", "Recibos", JSON.stringify([dish])])).toBeNull();
  });

  it("rechaza nombre o comprobante repetido en el mes", async () => {
    expect((await insert(A, [ra, period, "  LUZ   y agua ", "otro", "cif", "1", "equivalent", "fixed", "x", "[]"]))?.code).toBe("23505");
    expect((await insert(A, [ra, period, "Agua", "luz y agua", "cif", "1", "equivalent", "fixed", "x", "[]"]))?.code).toBe("23505");
  });

  it("rechaza clasificación, base, comportamiento o justificación inválidos", async () => {
    expect((await insert(A, [ra, period, "A", "a", "otro", "1", "equivalent", "fixed", "x", "[]"]))?.code).toBe("23514");
    expect((await insert(A, [ra, period, "B", "b", "cif", "1", "peso", "fixed", "x", "[]"]))?.code).toBe("23514");
    expect((await insert(A, [ra, period, "C", "c", "cif", "1", "equivalent", "mixto", "x", "[]"]))?.code).toBe("23514");
    expect((await insert(A, [ra, period, "D", "d", "cif", "1", "equivalent", "fixed", "  ", "[]"]))?.code).toBe("23514");
  });

  it("los destinatarios deben ser platos de este restaurante", async () => {
    const e = await insert(A, [ra, period, "Gas", "gas", "cif", "1", "equivalent", "fixed", "x", JSON.stringify([foreignDish])]);
    expect(e?.message).toMatch(/platos de este restaurante/);
  });

  it("otro usuario no ve ni crea gastos ajenos", async () => {
    expect(await t.as(B, "select id from cost_concepts where restaurant_id = $1", [ra])).toEqual([]);
    expect(await insert(B, [ra, period, "Intruso", "intruso", "cif", "1", "equivalent", "fixed", "x", "[]"])).not.toBeNull();
  });
});
