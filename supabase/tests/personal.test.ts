// Fase 8: personal (trabajadores, costo mensual, operaciones por receta, borrado y aislamiento).
// Equivale a los casos con base de datos de test_labor_table.py, test_personnel_editing.py y test_planning.py.
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, uid } from "./db";

const A = uid(31);
const B = uid(32);
let t: Awaited<ReturnType<typeof createDb>>;
let ra: string;
let period: number;
let recipe: number;
let cook: number;

const one = async <T = Record<string, unknown>>(u: string, sql: string, params: unknown[] = []) => (await t.as<T>(u, sql, params))[0];
const data = JSON.stringify({
  components: [{ name: "Remuneración", amount: "2400", source: "Prueba" }],
  fractions: { mod: "1", cif: "0", admin: "0", sales: "0" },
  days: "20",
  hours: "8",
  excluded: "0",
  productive: "0.8",
  basis: "equivalent",
  direct_basis: "time",
  planned_units: "0",
  justification: "Cocina",
});

beforeAll(async () => {
  t = await createDb();
  await t.signUp(A, { name: "Ana", restaurant: "El Puerto" });
  await t.signUp(B, { name: "Beto", restaurant: "Otro" });
  ({ id: ra } = await one<{ id: string }>(A, "select id from restaurants"));
  ({ id: period } = await one<{ id: number }>(A, "select id from periods where restaurant_id = $1", [ra]));
  const { id: product } = await one<{ id: number }>(A, "select public.create_product($1, 'Ceviche', null, null, 20) id", [ra]);
  ({ id: recipe } = await one<{ id: number }>(A, "select id from recipe_versions where product_id = $1", [product]));
  ({ id: cook } = await one<{ id: number }>(A, "insert into employees (restaurant_id, name, role, document) values ($1, 'Rosa Quispe', 'Cocinera', '45678912') returning id", [ra]));
}, 60_000);

describe("trabajadores y costo mensual", () => {
  it("no repite documento (sin importar mayúsculas)", async () => {
    const e = await t.fails(A, "insert into employees (restaurant_id, name, role, document) values ($1, 'Otra', 'Ayudante', ' 45678912 ')", [ra]);
    expect(e?.code).toBe("23505");
  });

  it("un costo por trabajador y mes, del mismo restaurante", async () => {
    await t.as(A, "insert into employee_period_costs (restaurant_id, employee_id, period_id, data) values ($1, $2, $3, $4::jsonb)", [ra, cook, period, data]);
    expect((await t.fails(A, "insert into employee_period_costs (restaurant_id, employee_id, period_id, data) values ($1, $2, $3, $4::jsonb)", [ra, cook, period, data]))?.code).toBe("23505");
  });
});

describe("operaciones por receta", () => {
  it("agrega operaciones, rechaza repetidas y quita la marca sin MOD", async () => {
    await t.as(A, "select public.set_recipe_work($1, false, true)", [recipe]);
    await t.as(A, "select public.add_operation($1, $2, ' Cortar   pescado ', 160)", [recipe, cook]);
    const w = await one<{ operations: unknown; no_labor: boolean }>(A, "select operations, no_labor from recipe_work where recipe_id = $1", [recipe]);
    expect(w).toEqual({ operations: [{ employee_id: cook, activity: "Cortar pescado", minutes: "160" }], no_labor: false });
    expect((await t.fails(A, "select public.add_operation($1, $2, 'cortar PESCADO', 10)", [recipe, cook]))?.message).toMatch(/ya está asignada/);
    await t.as(A, "select public.add_operation($1, $2, 'Servir', 16)", [recipe, cook]);
  });

  it("valida las marcas de aplicabilidad", async () => {
    expect((await t.fails(A, "select public.set_recipe_work($1, false, true)", [recipe]))?.message).toMatch(/Retira las operaciones/);
    const { id: mat } = await one<{ id: number }>(A, "select id from materials where restaurant_id = $1 limit 1", [ra]);
    const { id: cost } = await one<{ id: number }>(A, "select id from material_cost_versions where material_id = $1 limit 1", [mat]);
    const { id: product } = await one<{ id: number }>(A, "select product_id id from recipe_versions where id = $1", [recipe]);
    await t.as(A, "select public.save_recipe($1, 1, $2::jsonb)", [product, JSON.stringify([{ material_id: mat, cost_version_id: cost, quantity: "1", unit_key: "unit:kg", mode: "gross", rate: "0" }])]);
    const { id: v2 } = await one<{ id: number }>(A, "select id from recipe_versions where product_id = $1 and number = 2", [product]);
    expect((await t.fails(A, "select public.set_recipe_work($1, true, false)", [v2]))?.message).toMatch(/tiene insumos/);
    // La nueva versión heredó las operaciones.
    expect(await one(A, "select jsonb_array_length(operations) n from recipe_work where recipe_id = $1", [v2])).toEqual({ n: 2 });
  });

  it("quita una operación por posición", async () => {
    await t.as(A, "select public.remove_operation($1, 0)", [recipe]);
    expect(await one(A, "select operations from recipe_work where recipe_id = $1", [recipe])).toEqual({ operations: [{ employee_id: cook, activity: "Servir", minutes: "16" }] });
    expect((await t.fails(A, "select public.remove_operation($1, 5)", [recipe]))?.message).toMatch(/ya no existe/);
  });
});

describe("eliminar y aislamiento", () => {
  it("otro usuario no ve trabajadores ni edita operaciones ajenas", async () => {
    expect(await t.as(B, "select id from employees where restaurant_id = $1", [ra])).toEqual([]);
    expect((await t.fails(B, "select public.add_operation($1, $2, 'Intruso', 1)", [recipe, cook]))?.code).toBe("42501");
    expect((await t.fails(B, "select public.delete_employee($1)", [cook]))?.code).toBe("42501");
  });

  it("eliminar quita sus costos y operaciones en todas las versiones", async () => {
    await t.as(A, "select public.delete_employee($1)", [cook]);
    expect(await one(A, "select count(*)::int n from employee_period_costs where restaurant_id = $1", [ra])).toEqual({ n: 0 });
    const ops = await t.as<{ n: number }>(A, "select jsonb_array_length(operations) n from recipe_work where restaurant_id = $1", [ra]);
    expect(ops.every((r) => r.n === 0)).toBe(true);
  });
});
