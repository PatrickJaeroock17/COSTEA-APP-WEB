import { getAppContext } from "@/lib/auth";
import { getBudget } from "@/lib/data/budgets";

/** Fotografía completa del presupuesto en JSON (legacy: budget_download). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, ctx] = await Promise.all([params, getAppContext()]);
  const budgetId = Number(id);
  if (!ctx.restaurant || !Number.isInteger(budgetId)) return new Response("No encontrado", { status: 404 });
  const budget = await getBudget(ctx.restaurant.id, budgetId);
  if (!budget) return new Response("No encontrado", { status: 404 });
  return new Response(JSON.stringify(budget.snapshot, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="presupuesto-${budget.id}-v${budget.number}.json"`,
    },
  });
}
