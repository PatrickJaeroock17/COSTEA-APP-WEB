import "server-only";
import { createClient } from "@/lib/supabase/server";
import { laborCost } from "@/lib/costing/costing";
import { D, sum } from "@/lib/costing/decimal";
import { summarize } from "@/lib/costing/sales";
import { getConcepts } from "@/lib/data/expenses";
import { fetchAll } from "@/lib/data/materials";
import { getEmployees, getPeriodCosts, staffInputs } from "@/lib/data/personal";

export type SaleRow = {
  id: number;
  product_id: number;
  sold_on: string;
  quantity: string;
  unit_price: string;
  unit_cost: string;
  /** Tasa de IGV congelada en la venta. */
  igv_rate: string;
  products: { name: string } | null;
};

const monthRange = (year: number, month: number) => {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(last).padStart(2, "0")}` };
};

/**
 * Resultados reales del mes (legacy: services/sales.monthly_results): ventas del mes, gastos fijos
 * (conceptos fijos + costo total de la planilla del mes) y variables (conceptos no fijos).
 * `igvRate` es la tasa actual del restaurante: solo expresa el punto de equilibrio con IGV; cada venta usa la suya.
 */
export async function getMonthlyResults(restaurantId: string, period: { id: number; year: number; month: number }, igvRate: string) {
  const supabase = await createClient();
  const { start, end } = monthRange(period.year, period.month);
  const [sales, concepts, employees, costs] = await Promise.all([
    fetchAll<SaleRow>((a, b) =>
      supabase
        .from("sales")
        .select("id, product_id, sold_on, quantity::text, unit_price::text, unit_cost::text, igv_rate::text, products(name)")
        .eq("restaurant_id", restaurantId)
        .gte("sold_on", start)
        .lte("sold_on", end)
        .order("sold_on", { ascending: false })
        .order("id", { ascending: false })
        .range(a, b) as never,
    ),
    getConcepts(restaurantId, period.id),
    getEmployees(restaurantId),
    getPeriodCosts(restaurantId, period.id),
  ]);
  const active = concepts.filter((c) => c.active);
  const payroll = sum(staffInputs(employees, costs).map((s) => laborCost(s).total));
  const fixed = sum(active.filter((c) => c.behavior === "fixed").map((c) => new D(c.amount))).plus(payroll);
  const variable = sum(active.filter((c) => c.behavior !== "fixed").map((c) => new D(c.amount)));
  const result = summarize(
    sales.map((s) => ({ productId: s.product_id, productName: s.products?.name ?? `Plato #${s.product_id}`, quantity: s.quantity, unitPrice: s.unit_price, unitCost: s.unit_cost, taxRate: s.igv_rate })),
    fixed.toFixed(),
    variable.toFixed(),
    igvRate,
  );
  const configured = new Set(costs.map((c) => c.employee_id));
  return {
    ...result,
    sales,
    payroll,
    missingStaff: employees.filter((e) => e.active && !configured.has(e.id)).length,
    range: { start, end },
  };
}
