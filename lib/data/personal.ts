import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { StaffInput } from "@/lib/costing/costing";
import { type EmployeePeriodCostData, payrollInput } from "@/lib/costing/planning";
import { fetchAll } from "@/lib/data/materials";

export type EmployeeRow = { id: number; name: string; role: string; document: string | null; active: boolean };
export type PeriodCostRow = {
  id: number;
  employee_id: number;
  period_id: number;
  data: EmployeePeriodCostData;
  breakdown: { inputs: Record<string, string | null> } | null;
};
export type Operation = { employee_id: number; activity: string; minutes: string };

export async function getEmployees(restaurantId: string): Promise<EmployeeRow[]> {
  const supabase = await createClient();
  return fetchAll<EmployeeRow>((a, b) =>
    supabase.from("employees").select("id, name, role, document, active").eq("restaurant_id", restaurantId).order("role").order("name").range(a, b),
  );
}

/** Costos mensuales guardados del restaurante (todos los meses o uno). */
export async function getPeriodCosts(restaurantId: string, periodId?: number): Promise<PeriodCostRow[]> {
  const supabase = await createClient();
  return fetchAll<PeriodCostRow>((a, b) => {
    let q = supabase.from("employee_period_costs").select("id, employee_id, period_id, data, breakdown").eq("restaurant_id", restaurantId);
    if (periodId) q = q.eq("period_id", periodId);
    return q.order("id").range(a, b) as never;
  });
}

/** Entradas del motor (legacy: payroll_input) para los costos del mes. */
export function staffInputs(employees: EmployeeRow[], costs: PeriodCostRow[]): StaffInput[] {
  const byId = new Map(employees.map((e) => [e.id, e]));
  return costs
    .filter((c) => byId.has(c.employee_id))
    .map((c) => payrollInput({ employeeId: c.employee_id, employee: { name: byId.get(c.employee_id)!.name, role: byId.get(c.employee_id)!.role }, data: c.data, breakdown: c.breakdown as never }));
}

export type RecipeOption = {
  productId: number;
  name: string;
  recipeId: number;
  number: number;
  output: string;
  lines: number;
  work: { operations: Operation[]; no_materials: boolean; no_labor: boolean } | null;
};

/** Versión vigente de cada plato activo con su mano de obra asignada. */
export async function getRecipeOptions(restaurantId: string): Promise<RecipeOption[]> {
  const supabase = await createClient();
  const [products, versions, work, lines] = await Promise.all([
    fetchAll<{ id: number; name: string }>((a, b) => supabase.from("products").select("id, name").eq("restaurant_id", restaurantId).eq("active", true).order("name").range(a, b)),
    fetchAll<{ id: number; product_id: number; number: number; output_quantity: string }>((a, b) =>
      supabase.from("recipe_versions").select("id, product_id, number, output_quantity::text").eq("restaurant_id", restaurantId).order("id").range(a, b) as never,
    ),
    fetchAll<{ recipe_id: number; operations: Operation[]; no_materials: boolean; no_labor: boolean }>((a, b) =>
      supabase.from("recipe_work").select("recipe_id, operations, no_materials, no_labor").eq("restaurant_id", restaurantId).order("id").range(a, b) as never,
    ),
    fetchAll<{ recipe_id: number }>((a, b) => supabase.from("recipe_lines").select("recipe_id").eq("restaurant_id", restaurantId).order("id").range(a, b)),
  ]);
  const latest = new Map<number, (typeof versions)[number]>();
  for (const v of versions) if ((latest.get(v.product_id)?.number ?? 0) < v.number) latest.set(v.product_id, v);
  const workOf = new Map(work.map((w) => [w.recipe_id, w]));
  const lineCount = new Map<number, number>();
  for (const l of lines) lineCount.set(l.recipe_id, (lineCount.get(l.recipe_id) ?? 0) + 1);
  return products
    .filter((p) => latest.has(p.id))
    .map((p) => {
      const v = latest.get(p.id)!;
      const w = workOf.get(v.id);
      return {
        productId: p.id,
        name: p.name,
        recipeId: v.id,
        number: v.number,
        output: v.output_quantity,
        lines: lineCount.get(v.id) ?? 0,
        work: w ? { operations: w.operations, no_materials: w.no_materials, no_labor: w.no_labor } : null,
      };
    });
}
