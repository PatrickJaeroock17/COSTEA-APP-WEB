// Vistas derivadas del resultado del plan. Nunca recalculan con otra lógica: solo dividen o agrupan.
// legacy: services/portion_summary.py, production_table.py, overhead_tables.py
import { D, type Dec, type Key, type Num, ZERO, sum } from "./decimal";
import type { ConceptKind, PlanAllocation, PlanResult, PriceResult } from "./costing";

/* ------------------------------------------------------------------ */
/* Resumen de una porción                                              */
/* ------------------------------------------------------------------ */

export interface PortionSummary {
  name: string;
  unit: string;
  complete: boolean;
  /** CMP y MOD ya son unitarios; CIF y gastos se dividen entre las porciones del mes. */
  components: [string, Dec | null][];
  total: Dec | null;
  profit: Dec | null;
  net: Dec | null;
  tax: Dec | null;
  final: Dec | null;
  suggested: Dec | null;
  taxRate: Dec;
  issues: string[];
}

export function portionSummary(result: PlanResult, lineId: Key, taxRate: Num): PortionSummary {
  const row = result.rows.find((r) => String(r.id) === String(lineId));
  if (!row) throw new Error("Línea del plan inexistente.");
  const q = row.quantity;
  const unit = (v: Dec) => (q.isZero() ? null : v.div(q));
  const other = q.isZero() ? null : row.expenses.minus(row.admin).minus(row.selling).minus(row.finance).div(q);
  const complete = result.issues.length === 0 && q.gt(0) && row.price !== null;
  const price: PriceResult | null = complete ? row.price : null;
  return {
    name: row.name,
    unit: row.unit,
    complete,
    components: [
      ["Materia prima", row.cmp],
      ["Mano de obra directa", row.mod],
      ["CIF", unit(row.cif)],
      ["Gastos administrativos", unit(row.admin)],
      ["Gastos de ventas", unit(row.selling)],
      ["Gastos financieros", unit(row.finance)],
      ["Otros gastos", other],
    ],
    total: complete ? row.complete : null,
    profit: price?.result ?? null,
    net: price?.net ?? null,
    tax: price?.tax ?? null,
    final: price?.final ?? null,
    suggested: price?.suggested ?? null,
    taxRate: new D(taxRate),
    issues: result.issues,
  };
}

/* ------------------------------------------------------------------ */
/* Producción y ventas netas por plato                                 */
/* ------------------------------------------------------------------ */

export interface ProductionRow {
  name: string;
  quantity: Dec;
  unit: string;
  share: Dec | null;
  net: Dec | null;
  sales: Dec | null;
  cost: Dec | null;
  totalCost: Dec | null;
  salesShare: Dec | null;
}

export function productionTable(result: PlanResult) {
  const compatible = new Set(result.rows.map((r) => r.unit)).size <= 1;
  const quantity = compatible ? sum(result.rows.map((r) => r.quantity)) : null;
  const rows: ProductionRow[] = result.rows.map((r) => {
    const net = r.price ? r.price.net : null;
    return {
      name: r.name,
      quantity: r.quantity,
      unit: r.unit,
      share: quantity && !quantity.isZero() ? r.quantity.div(quantity) : null,
      net,
      sales: net !== null ? net.times(r.quantity) : null,
      cost: r.complete,
      totalCost: r.complete !== null ? r.complete.times(r.quantity) : null,
      salesShare: null,
    };
  });
  const sales = rows.every((r) => r.sales !== null) ? sum(rows.map((r) => r.sales!)) : null;
  for (const row of rows) {
    row.salesShare = sales && !sales.isZero() && row.sales !== null ? row.sales.div(sales) : null;
  }
  return {
    rows,
    quantity,
    sales,
    cost: rows.every((r) => r.totalCost !== null) ? sum(rows.map((r) => r.totalCost!)) : null,
    issues: result.issues,
    idle: result.totals.idle,
    unassigned: result.totals.unassigned,
  };
}

/* ------------------------------------------------------------------ */
/* Tablas de CIF y gastos (derivadas del reparto del plan)             */
/* ------------------------------------------------------------------ */

export const OVERHEAD_TITLES: Record<ConceptKind, string> = {
  cif: "COSTOS INDIRECTOS DEL RESTAURANTE (FABRICACIÓN)",
  admin: "GASTOS ADMINISTRATIVOS",
  sales: "GASTOS DE VENTAS",
  finance: "Gastos financieros",
  other: "Otros gastos operativos",
};

export interface OverheadRecord {
  id: Key;
  name: string;
  kind: ConceptKind;
  amount: Num;
  active: boolean;
  basis: string;
}

export interface OverheadRow {
  key: string;
  id: Key | null;
  name: string;
  kind: ConceptKind;
  amount: Dec;
  active: boolean;
  basis: string;
  payroll: boolean;
  percent: Dec | null;
  assigned: Dec | null;
  unitCost: Dec | null;
  quantity: Dec | null;
}

export interface OverheadGroup {
  kind: ConceptKind;
  title: string;
  rows: OverheadRow[];
  monthly: Dec;
  total: Dec | null;
}

type AllocationLike = Pick<PlanAllocation, "id" | "bases" | "exact"> & Partial<Pick<PlanAllocation, "name" | "kind" | "amount" | "basis">>;

/** Agrupa conceptos (y la parte indirecta del personal) por tipo; con `line`, muestra lo asignado a esa línea. */
export function overheadTables(
  records: OverheadRecord[],
  result?: { allocations: AllocationLike[] } | null,
  line?: { id: Key; quantity: Num } | null,
): OverheadGroup[] {
  const allocations = new Map<string, AllocationLike>((result?.allocations ?? []).map((a) => [String(a.id), a]));
  const lineQty = line ? new D(line.quantity) : null;
  const inputs = [
    ...records.map((c) => ({
      key: `concept-${c.id}`,
      id: c.id as Key | null,
      name: c.name,
      kind: c.kind,
      amount: new D(c.amount),
      active: c.active,
      basis: c.basis,
      payroll: false,
    })),
    ...[...allocations.values()]
      .filter((a) => String(a.id).startsWith("salary-"))
      .map((a) => ({
        key: String(a.id),
        id: null,
        name: a.name ?? "",
        kind: a.kind as ConceptKind,
        amount: new D(a.amount ?? 0),
        active: true,
        basis: a.basis ?? "",
        payroll: true,
      })),
  ];
  const findIn = (m: Map<Key, Dec>, id: Key) => {
    for (const [k, v] of m) if (String(k) === String(id)) return v;
    return undefined;
  };
  const groups: OverheadGroup[] = [];
  for (const [kind, title] of Object.entries(OVERHEAD_TITLES) as [ConceptKind, string][]) {
    const rows: OverheadRow[] = [];
    for (const item of inputs.filter((i) => i.kind === kind)) {
      let percent: Dec | null = null;
      let assigned: Dec | null = null;
      let unitCost: Dec | null = null;
      const a = allocations.get(item.key);
      if (line && !item.active) {
        percent = ZERO;
        assigned = ZERO;
        unitCost = ZERO;
      } else if (line && a) {
        const base = sum(a.bases.values());
        percent = base.isZero() ? null : (findIn(a.bases, line.id) ?? ZERO).div(base);
        // Sin denominador queda pendiente, salvo un importe realmente cero.
        if (!base.isZero() || item.amount.isZero()) {
          assigned = findIn(a.exact, line.id) ?? ZERO;
          unitCost = lineQty && !lineQty.isZero() ? assigned.div(lineQty) : null;
        }
      }
      rows.push({ ...item, percent, assigned, unitCost, quantity: line ? lineQty : null });
    }
    if (kind === "cif" || kind === "admin" || kind === "sales" || rows.length) {
      groups.push({
        kind,
        title,
        rows,
        monthly: sum(rows.filter((r) => r.active).map((r) => r.amount)),
        total:
          line && lineQty && !lineQty.isZero() && rows.every((r) => r.unitCost !== null)
            ? sum(rows.map((r) => r.unitCost!))
            : null,
      });
    }
  }
  return groups;
}
