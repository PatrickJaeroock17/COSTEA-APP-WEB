import "server-only";
import type { AppContext } from "@/lib/auth";
import { laborCost } from "@/lib/costing/costing";
import { D, sum } from "@/lib/costing/decimal";
import { getConcepts } from "@/lib/data/expenses";
import { getMaterialSummaries } from "@/lib/data/materials";
import { getEmployees, getPeriodCosts, getRecipeOptions, staffInputs } from "@/lib/data/personal";
import { type PlanEvaluation, getMonthPlanEvaluation } from "@/lib/data/plan";
import { periodDates } from "@/lib/materials";

/**
 * Resumen del Inicio con los datos reales del mes de trabajo. No calcula costos por su cuenta:
 * reutiliza la evaluación del plan (la misma de Costo y precio y Plan), los gastos del mes, la
 * planilla y los precios vigentes de los insumos.
 */
export async function getHomeSummary(ctx: AppContext) {
  const r = ctx.restaurant!;
  const period = ctx.period;
  const reference = periodDates(period).reference;
  const [materials, recipes, employees, costs, concepts, evaluation] = await Promise.all([
    getMaterialSummaries(r.id, reference),
    getRecipeOptions(r.id),
    getEmployees(r.id),
    period ? getPeriodCosts(r.id, period.id) : Promise.resolve([]),
    period ? getConcepts(r.id, period.id) : Promise.resolve([]),
    period ? getMonthPlanEvaluation(r.id, period.id, r.name, r.currency) : Promise.resolve(null as PlanEvaluation | null),
  ]);

  const activeMaterials = materials.filter((m) => m.active);
  // Precio vencido = insumo activo sin precio vigente al fin del mes, o con un aviso de precio en el plan del mes.
  const planPriceIssues = (evaluation?.result.issues ?? []).filter((i) => /tiene vigencia posterior|valoración pendiente/.test(i));
  const withoutPrice = activeMaterials.filter((m) => !m.price);

  const dishesWithRecipe = recipes.filter((x) => x.lines > 0);
  const activeEmployees = employees.filter((e) => e.active);
  const configured = new Set(costs.map((c) => c.employee_id));
  const missingStaff = activeEmployees.filter((e) => !configured.has(e.id));

  // Gastos del mes: conceptos activos + parte indirecta de la planilla (como en Gastos).
  const activeConcepts = concepts.filter((c) => c.active);
  const payroll = staffInputs(employees, costs).map(laborCost);
  const salesExpense = activeConcepts.some((c) => c.kind === "sales") || payroll.some((p) => !p.indirect.sales.isZero());
  const monthlyExpenses = sum([...activeConcepts.map((c) => new D(c.amount)), ...payroll.map((p) => p.indirect.cif.plus(p.indirect.admin).plus(p.indirect.sales))]);

  const plan = evaluation?.plan ?? null;
  const result = evaluation?.result ?? null;
  const declaredNone = Boolean(plan?.no_cif && plan?.no_expenses);
  const calculable = result?.status === "calculable";

  return {
    period,
    reference,
    materials: { active: activeMaterials.length, priced: activeMaterials.length - withoutPrice.length, withoutPrice: withoutPrice.length, planPriceIssues },
    dishes: { active: recipes.length, withRecipe: dishesWithRecipe.length },
    staff: { active: activeEmployees.length, missing: missingStaff.map((e) => e.name) },
    expenses: { count: activeConcepts.length, monthly: monthlyExpenses, salesExpense, declaredNone, noExpensesDeclared: Boolean(plan?.no_expenses) },
    plan: plan ? { id: plan.id, name: plan.name, lines: evaluation!.lines.length, status: result!.status, issues: result!.issues } : null,
    totals: result?.totals ?? null,
    calculable,
    /** Porciones del mes en el plan (para el costo completo promedio por porción). */
    portions: result ? sum(result.rows.map((x) => x.quantity)) : null,
  };
}

export type HomeSummary = Awaited<ReturnType<typeof getHomeSummary>>;
