// Datos de los gráficos de Reportes. Solo reorganiza lo que ya calculó el motor (PlanResult) y los
// resultados del mes: no hay fórmulas nuevas. Todo sale como texto decimal (serializable al cliente);
// el cliente solo convierte a `number` para dibujar y formatea los tooltips desde el texto exacto.
import { D, type Dec } from "@/lib/costing/decimal";
import type { PlanResult } from "@/lib/costing/costing";
import type { BudgetSnapshot } from "@/lib/data/budgets";

type Text = string;
const txt = (d: Dec | string | null | undefined): Text | null => (d === null || d === undefined ? null : new D(d).toFixed());

export type CostPortionDatum = {
  name: string;
  /** Por porción. CIF y gastos por porción = producción − MP − MOD y costo completo − producción (las mismas divisiones del motor). */
  mp: Text;
  mo: Text;
  cif: Text;
  gastos: Text;
  complete: Text;
  net: Text | null;
  margin: Text | null;
};

export type CompositionPart = { key: "mp" | "mo" | "cif" | "gastos" | "idle"; label: string; value: Text };

export type MarginDatum = { name: string; margin: Text; result: Text; net: Text; complete: Text };

export type Breakeven = { equilibrium: Text | null; equilibriumGross: Text | null; ratio: Text | null; net: Text };

export type BudgetProgress = { id: number; name: string; planned: Dec; sold: Dec; progress: Dec | null };

export type BudgetChart = {
  version: number;
  totals: { concept: string; budget: Text | null; actual: Text }[];
  portions: { name: string; planned: Text; sold: Text; progress: Text | null }[];
};

export type CapacityDatum = {
  name: string;
  basis: "time" | "quantity";
  available: Text;
  required: Text;
  excess: Text;
  idle: Text;
};

export type ReportChartsData = {
  currency: string;
  costPerPortion: CostPortionDatum[];
  composition: { parts: CompositionPart[]; total: Text };
  margins: MarginDatum[];
  withoutPrice: number;
  breakeven: Breakeven;
  budget: BudgetChart | null;
  capacity: { staff: CapacityDatum[]; idle: Text; modAvailable: Text; modAssigned: Text };
};

type MonthlyActual = {
  net: Dec;
  materials: Dec;
  equilibrium: Dec | null;
  equilibriumGross: Dec | null;
  ratio: Dec | null;
  rows: { name: string; quantity: Dec }[];
};

/** Avance de porciones del presupuesto publicado frente a lo vendido (lo usan la tabla y el gráfico). */
export function budgetProgress(snap: BudgetSnapshot, actual: Pick<MonthlyActual, "rows">): BudgetProgress[] {
  return snap.result.rows.map((row) => {
    const sold = actual.rows.find((x) => x.name === row.name)?.quantity ?? new D(0);
    const planned = new D(row.quantity);
    return { id: row.id, name: row.name, planned, sold, progress: planned.isZero() ? null : sold.div(planned) };
  });
}

export function buildReportCharts(
  result: PlanResult,
  actual: MonthlyActual,
  snap: BudgetSnapshot | null,
  budgetNumber: number | null,
  currency: string,
): ReportChartsData {
  const t = result.totals;
  const costPerPortion: CostPortionDatum[] = result.rows
    .filter((r) => r.production !== null && r.complete !== null)
    .map((r) => ({
      name: r.name,
      mp: r.cmp.toFixed(),
      mo: r.mod.toFixed(),
      cif: r.production!.minus(r.cmp).minus(r.mod).toFixed(),
      gastos: r.complete!.minus(r.production!).toFixed(),
      complete: r.complete!.toFixed(),
      net: txt(r.price?.net),
      margin: txt(r.price?.margin),
    }));

  const priced = result.rows.filter((r) => r.price && r.price.margin !== null && r.complete !== null);
  const margins: MarginDatum[] = priced.map((r) => ({
    name: r.name,
    margin: r.price!.margin!.toFixed(),
    result: r.price!.result.toFixed(),
    net: r.price!.net.toFixed(),
    complete: r.complete!.toFixed(),
  }));

  return {
    currency,
    costPerPortion,
    // Costos del periodo = materiales + MOD disponible (asignada + no absorbida) + CIF + gastos.
    composition: {
      parts: [
        { key: "mp", label: "Materiales", value: t.cmp.toFixed() },
        { key: "mo", label: "MOD asignada", value: t.modAssigned.toFixed() },
        { key: "cif", label: "CIF", value: t.cif.toFixed() },
        { key: "gastos", label: "Gastos", value: t.expenses.toFixed() },
        { key: "idle", label: "MOD no absorbida", value: t.idle.toFixed() },
      ],
      total: t.costs.toFixed(),
    },
    margins,
    withoutPrice: result.rows.length - priced.length,
    breakeven: {
      equilibrium: txt(actual.equilibrium),
      equilibriumGross: txt(actual.equilibriumGross),
      ratio: txt(actual.ratio),
      net: actual.net.toFixed(),
    },
    budget: snap
      ? {
          version: budgetNumber ?? 0,
          totals: [
            { concept: "Ventas netas", budget: snap.result.totals.sales ?? null, actual: actual.net.toFixed() },
            { concept: "Materia prima", budget: snap.result.totals.cmp ?? null, actual: actual.materials.toFixed() },
          ],
          portions: budgetProgress(snap, actual).map((p) => ({ name: p.name, planned: p.planned.toFixed(), sold: p.sold.toFixed(), progress: txt(p.progress) })),
        }
      : null,
    capacity: {
      staff: result.staff.map((s) => {
        const byQuantity = s.directBasis === "quantity";
        return {
          name: s.name,
          basis: byQuantity ? "quantity" : "time",
          available: (byQuantity ? s.plannedUnits : s.minutes).toFixed(),
          required: (byQuantity ? s.requiredUnits : s.required).toFixed(),
          excess: (byQuantity ? s.excessUnits : s.excess).toFixed(),
          idle: s.idle.toFixed(),
        };
      }),
      idle: t.idle.toFixed(),
      modAvailable: t.modAvailable.toFixed(),
      modAssigned: t.modAssigned.toFixed(),
    },
  };
}
