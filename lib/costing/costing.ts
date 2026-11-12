// legacy: services/costing.py — motor Decimal v1: mano de obra, reparto, precios y plan mensual conciliado.
import Decimal from "decimal.js";
import {
  CENT,
  D,
  type Dec,
  type Key,
  type Num,
  ONE,
  ZERO,
  compareKeys,
  decimalText,
  maxDec,
  money,
  nonnegative,
  sum,
} from "./decimal";
import { type QuantityMode, calculateLine } from "./recipes";

export const ENGINE = "1.3.0";

/* ------------------------------------------------------------------ */
/* Mano de obra                                                        */
/* ------------------------------------------------------------------ */

export type AllocationBasis = "equivalent" | "mod" | "sales";
export type ConceptKind = "cif" | "admin" | "sales" | "finance" | "other";
export type DirectBasis = "time" | "quantity";

export interface Fractions {
  mod: Num;
  cif: Num;
  admin: Num;
  sales: Num;
}

export interface StaffInput {
  id: Key;
  name: string;
  role?: string;
  components: { name?: string; amount: Num; source?: string }[];
  /** Reparto del costo mensual: MOD, CIF, administración y ventas. Debe sumar 1. */
  fractions: Fractions;
  days: Num;
  hours: Num;
  /** Minutos del mes excluidos (descansos, capacitación…). */
  excluded: Num;
  /** Factor productivo (0–1). */
  productive: Num;
  /** Base de asignación de la parte indirecta del sueldo. */
  basis: AllocationBasis;
  justification: string;
  /** MOD por tiempo (tarifa por minuto) o por cantidad (costo ÷ porciones previstas). */
  directBasis?: DirectBasis;
  plannedUnits?: Num;
}

export interface LaborCost {
  total: Dec;
  cost: Dec;
  minutes: Dec;
  rate: Dec | null;
  directBasis: DirectBasis;
  plannedUnits: Dec;
  unitRate: Dec | null;
  indirect: { cif: Dec; admin: Dec; sales: Dec };
}

const FRACTION_KEYS = ["mod", "cif", "admin", "sales"] as const;

export function laborCost(data: StaffInput): LaborCost {
  const total = sum(data.components.map((c) => nonnegative(c.amount)));
  const keys = Object.keys(data.fractions);
  const fractions = {} as Record<(typeof FRACTION_KEYS)[number], Dec>;
  if (keys.length !== 4 || !FRACTION_KEYS.every((k) => keys.includes(k))) {
    throw new Error("La distribución del personal debe sumar 100 %.");
  }
  for (const k of FRACTION_KEYS) fractions[k] = new D(data.fractions[k]);
  if (!sum(Object.values(fractions)).eq(1)) throw new Error("La distribución del personal debe sumar 100 %.");
  for (const value of [...Object.values(fractions), data.days, data.hours, data.excluded, data.productive]) nonnegative(value);
  const days = new D(data.days);
  const hours = new D(data.hours);
  const excluded = new D(data.excluded);
  const productive = new D(data.productive);
  const programmed = days.times(hours).times(60);
  if (excluded.gt(programmed) || productive.gt(1)) throw new Error("Tiempo excluido o productividad inválidos.");
  const effective = programmed.minus(excluded).times(productive);
  const directCost = total.times(fractions.mod);
  const minutes = effective.times(fractions.mod);
  const rate = minutes.isZero() ? null : directCost.div(minutes);
  const directBasis = data.directBasis ?? "time";
  if (directBasis !== "time" && directBasis !== "quantity") throw new Error("Base de mano de obra inválida.");
  const plannedUnits = nonnegative(data.plannedUnits ?? "0");
  return {
    total,
    cost: directCost,
    minutes,
    rate,
    directBasis,
    plannedUnits,
    unitRate: plannedUnits.isZero() ? null : directCost.div(plannedUnits),
    indirect: {
      cif: total.times(fractions.cif),
      admin: total.times(fractions.admin),
      sales: total.times(fractions.sales),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Reparto de un importe por bases                                     */
/* ------------------------------------------------------------------ */

export interface Allocation {
  /** Reparto exacto; el residuo de precisión va a la mayor base positiva. */
  exact: Map<Key, Dec>;
  /** Reparto a céntimos que suma exactamente el importe redondeado. */
  rounded: Map<Key, Dec>;
  /** Importe sin base de asignación (todas las bases en cero). */
  unassigned: Dec;
}

export function allocation(amount: Num, bases: Map<Key, Num>): Allocation {
  const total = nonnegative(amount);
  const b = new Map<Key, Dec>();
  for (const [k, v] of bases) b.set(k, nonnegative(v));
  const base = sum(b.values());
  const exact = new Map<Key, Dec>();
  for (const [k, v] of b) exact.set(k, base.isZero() ? ZERO : total.times(v).div(base));
  if (!base.isZero()) {
    const positive = [...b.keys()].filter((k) => b.get(k)!.gt(0));
    positive.sort((x, y) => b.get(y)!.cmp(b.get(x)!) || compareKeys(x, y));
    const key = positive[0];
    exact.set(key, exact.get(key)!.plus(total.minus(sum(exact.values()))));
  }
  const rounded = new Map<Key, Dec>();
  for (const [k, v] of exact) rounded.set(k, v.toDecimalPlaces(2, Decimal.ROUND_FLOOR));
  if (!base.isZero()) {
    const cents = money(total).minus(sum(rounded.values())).div(CENT).trunc().toNumber();
    const order = [...exact.keys()].sort(
      (x, y) =>
        exact.get(y)!.minus(rounded.get(y)!).cmp(exact.get(x)!.minus(rounded.get(x)!)) || compareKeys(x, y),
    );
    for (const k of order.slice(0, Math.max(0, cents))) rounded.set(k, rounded.get(k)!.plus(CENT));
  }
  return { exact, rounded, unassigned: base.isZero() ? total : ZERO };
}

/* ------------------------------------------------------------------ */
/* Precio de venta                                                     */
/* ------------------------------------------------------------------ */

/**
 * markup: neto = costo × (1 + recargo) · margin: neto = costo ÷ (1 − margen)
 * food_cost: neto = costo ÷ %costo · manual: el valor es el precio con impuesto.
 */
export type PricingMode = "markup" | "margin" | "manual" | "food_cost";

export interface PriceResult {
  suggested: Dec;
  final: Dec;
  net: Dec;
  tax: Dec;
  result: Dec;
  margin: Dec | null;
  markup: Dec | null;
  costRatio: Dec | null;
}

export function price(cost: Num, mode: PricingMode, value: Num, tax: Num, adopted: Num | null = null): PriceResult {
  const [c, v, t] = [cost, value, tax].map(nonnegative);
  if (
    t.gt(1) ||
    !["markup", "margin", "manual", "food_cost"].includes(mode) ||
    (mode === "margin" && v.gte(1)) ||
    (mode === "food_cost" && !(v.gt(0) && v.lte(1)))
  ) {
    throw new Error("Tasa, margen o modalidad inválidos.");
  }
  const suggestedNet =
    mode === "food_cost"
      ? c.div(v)
      : mode === "markup"
        ? c.times(ONE.plus(v))
        : mode === "margin"
          ? c.div(ONE.minus(v))
          : v.div(ONE.plus(t));
  const suggested = suggestedNet.times(ONE.plus(t));
  const final = money(adopted !== null && adopted !== undefined ? nonnegative(adopted) : suggested);
  const net = final.div(ONE.plus(t));
  return {
    suggested,
    final,
    net,
    tax: final.minus(net),
    result: net.minus(c),
    margin: net.isZero() ? null : net.minus(c).div(net),
    markup: c.isZero() ? null : net.minus(c).div(c),
    costRatio: net.isZero() ? null : c.div(net),
  };
}

/* ------------------------------------------------------------------ */
/* Plan mensual conciliado                                             */
/* ------------------------------------------------------------------ */

export interface ConceptInput {
  id: string;
  name: string;
  kind: ConceptKind;
  amount: Num;
  basis: AllocationBasis;
  /** Productos a los que aplica; vacío = todos. */
  targets: Key[];
  justification?: string;
  behavior?: string;
}

export interface PlanMaterialInput {
  name: string;
  materialId?: Key;
  baseUnit?: string;
  /** Versión de precio usada (id de material_cost_versions). */
  version: Key;
  quantity: Num;
  factor: Num;
  unitCost: Num;
  mode: QuantityMode;
  rate: Num;
  origin?: string | null;
  [extra: string]: unknown;
}

export interface PlanOperationInput {
  employeeId: Key;
  activity: string;
  minutes: Num;
}

export interface PlanLineInput {
  id: Key;
  productId: Key;
  name: string;
  unit: string;
  /** Porciones del mes. */
  quantity: Num;
  /** Rendimiento del lote de la receta. */
  output: Num;
  noMaterials: boolean;
  noLabor: boolean;
  materials: PlanMaterialInput[];
  operations: PlanOperationInput[];
  equivalentFactor: Num;
  referencePrice: Num;
  pricingMode: PricingMode;
  pricingValue: Num;
  /** Tasa de impuesto; null = sin configurar. */
  tax: Num | null;
  adoptedPrice: Num | null;
  pricePending?: boolean;
  [extra: string]: unknown;
}

export interface PlanInput {
  staff: StaffInput[];
  noCif: boolean;
  noExpenses: boolean;
  concepts: ConceptInput[];
  lines: PlanLineInput[];
  issues?: string[];
  [extra: string]: unknown;
}

export interface MaterialDetail {
  name: string;
  gross: Dec;
  amount: Dec;
  version: Key;
  unitCost: Dec;
  origin: string | null;
}

export interface LaborDetail {
  name: string;
  activity: string;
  minutes: Dec;
  rate: Dec;
  amount: Dec;
  byQuantity?: boolean;
}

export interface PlanRow {
  id: Key;
  name: string;
  unit: string;
  quantity: Dec;
  /** CMP, MOD y minutos son por unidad; CIF y gastos son totales del mes asignados a la línea. */
  cmp: Dec;
  mod: Dec;
  cif: Dec;
  expenses: Dec;
  admin: Dec;
  selling: Dec;
  finance: Dec;
  minutes: Dec;
  price: PriceResult | null;
  complete: Dec | null;
  production: Dec | null;
  materialDetails: MaterialDetail[];
  laborDetails: LaborDetail[];
}

export interface StaffRow extends LaborCost {
  id: Key;
  name: string;
  required: Dec;
  assigned: Dec;
  requiredUnits: Dec;
  excess: Dec;
  idle: Dec;
  excessUnits: Dec;
}

export interface Requirement {
  materialId: Key;
  name: string;
  unit: string;
  quantity: Dec;
  amount: Dec;
  priceVersions: Key[];
}

export type PlanConcept = Omit<ConceptInput, "amount"> & { amount: Dec };
export type PlanAllocation = PlanConcept & Allocation & { bases: Map<Key, Dec> };

export type PlanStatus = "calculable" | "incompleto" | "sin_base_asignacion" | "capacidad_excedida";

export interface PlanTotals {
  cmp: Dec;
  modAvailable: Dec;
  modAssigned: Dec;
  idle: Dec;
  cif: Dec;
  expenses: Dec;
  admin: Dec;
  selling: Dec;
  finance: Dec;
  production: Dec;
  unassigned: Dec;
  completeAssigned: Dec;
  costs: Dec;
  sales: Dec;
  profit: Dec | null;
  margin: Dec | null;
  bridge: Dec;
  difference: Dec;
}

export interface PlanResult {
  engine: string;
  status: PlanStatus;
  issues: string[];
  rows: PlanRow[];
  staff: StaffRow[];
  allocations: PlanAllocation[];
  requirements: Requirement[];
  totals: PlanTotals;
}

const sameKey = (a: Key, b: Key) => String(a) === String(b);

export function calculatePlan(data: PlanInput): PlanResult {
  const issues: string[] = [...(data.issues ?? [])];
  const rows = new Map<Key, PlanRow>();
  const staff = new Map<string, StaffRow>();
  const concepts: PlanConcept[] = data.concepts.map((c) => ({ ...c, amount: nonnegative(c.amount) }));
  const requirements = new Map<string, Requirement>();

  for (const employee of data.staff) {
    const result = laborCost(employee);
    staff.set(String(employee.id), {
      ...result,
      id: employee.id,
      name: employee.name,
      required: ZERO,
      assigned: ZERO,
      requiredUnits: ZERO,
      excess: ZERO,
      idle: ZERO,
      excessUnits: ZERO,
    });
    if (result.directBasis === "time" && result.cost.gt(0) && result.minutes.isZero()) {
      issues.push(`${employee.name}: costo MOD positivo sin minutos disponibles.`);
    }
    if (result.directBasis === "quantity" && result.plannedUnits.isZero()) {
      issues.push(`${employee.name}: indica las porciones mensuales previstas.`);
    }
    for (const kind of ["cif", "admin", "sales"] as const) {
      const amount = result.indirect[kind];
      if (!amount.isZero()) {
        concepts.push({
          id: `salary-${employee.id}-${kind}`,
          name: `Personal · ${employee.name} · ${kind}`,
          kind,
          amount,
          basis: employee.basis,
          targets: [],
          justification: employee.justification,
        });
      }
    }
  }

  const quantities = new Map<Key, Dec>();
  for (const line of data.lines) quantities.set(line.id, nonnegative(line.quantity));
  if (![...quantities.values()].some((q) => q.gt(0))) {
    issues.push("El plan necesita al menos un producto con cantidad positiva.");
  }

  for (const line of data.lines) {
    const key = line.id;
    const quantity = quantities.get(key)!;
    const output = new D(line.output);
    if (output.lte(0)) throw new Error("El lote debe producir una cantidad positiva.");
    const row: PlanRow = {
      id: key,
      name: line.name,
      unit: line.unit,
      quantity,
      cmp: ZERO,
      mod: ZERO,
      cif: ZERO,
      expenses: ZERO,
      admin: ZERO,
      selling: ZERO,
      finance: ZERO,
      minutes: ZERO,
      price: null,
      complete: null,
      production: null,
      materialDetails: [],
      laborDetails: [],
    };
    rows.set(key, row);
    if (quantity.isZero()) continue;
    if (!line.materials.length && !line.noMaterials) issues.push(`${line.name}: faltan insumos o declarar que no aplican.`);
    if (line.materials.length && line.noMaterials) issues.push(`${line.name}: no puede declarar sin materiales si hay insumos.`);
    if (!line.operations.length && !line.noLabor) issues.push(`${line.name}: faltan operaciones o declarar que no aplica MOD.`);
    if (line.operations.length && line.noLabor) issues.push(`${line.name}: hay operaciones y declaración sin MOD simultáneas.`);

    for (const material of line.materials) {
      const result = calculateLine({
        quantity: material.quantity,
        factor: material.factor,
        unitCost: material.unitCost,
        mode: material.mode,
        rate: material.rate,
      });
      row.cmp = row.cmp.plus(result.amount.div(output));
      // Consolida en la unidad base de compra de cada insumo, incluida la merma.
      const materialKey = material.materialId ?? material.name;
      let needed = requirements.get(String(materialKey));
      if (!needed) {
        needed = {
          materialId: materialKey,
          name: material.name,
          unit: material.baseUnit ?? "unidad base",
          quantity: ZERO,
          amount: ZERO,
          priceVersions: [],
        };
        requirements.set(String(materialKey), needed);
      }
      needed.quantity = needed.quantity.plus(result.grossQuantity.times(quantity).div(output));
      needed.amount = needed.amount.plus(result.amount.times(quantity).div(output));
      if (!needed.priceVersions.some((v) => sameKey(v, material.version))) needed.priceVersions.push(material.version);
      row.materialDetails.push({
        name: material.name,
        gross: result.grossQuantity,
        amount: result.amount,
        version: material.version,
        unitCost: new D(material.unitCost),
        origin: material.origin ?? null,
      });
    }

    const countedWorkers = new Set<string>();
    for (const operation of line.operations) {
      const employee = staff.get(String(operation.employeeId));
      if (employee && employee.directBasis === "quantity") {
        // Varias actividades de un mismo trabajador no deben cobrar dos veces cada porción.
        if (countedWorkers.has(String(operation.employeeId))) continue;
        countedWorkers.add(String(operation.employeeId));
        if (employee.unitRate === null) continue;
        const amount = employee.unitRate;
        row.mod = row.mod.plus(amount);
        employee.requiredUnits = employee.requiredUnits.plus(quantity);
        employee.assigned = employee.assigned.plus(amount.times(quantity));
        row.laborDetails.push({
          name: employee.name,
          activity: operation.activity,
          minutes: ZERO,
          rate: ZERO,
          amount,
          byQuantity: true,
        });
        continue;
      }
      const minutes = nonnegative(operation.minutes).div(output);
      if (minutes.isZero()) issues.push(`${line.name}: indica minutos positivos para el trabajador por tiempo.`);
      row.minutes = row.minutes.plus(minutes);
      if (!employee || employee.rate === null) {
        issues.push(`${line.name}: falta costo/tiempo MOD válido del trabajador #${operation.employeeId}.`);
        continue;
      }
      const amount = minutes.times(employee.rate);
      row.mod = row.mod.plus(amount);
      employee.required = employee.required.plus(minutes.times(quantity));
      employee.assigned = employee.assigned.plus(amount.times(quantity));
      row.laborDetails.push({ name: employee.name, activity: operation.activity, minutes, rate: employee.rate, amount });
    }
  }

  let capacity = false;
  for (const employee of staff.values()) {
    employee.excess = maxDec(ZERO, employee.required.minus(employee.minutes));
    employee.idle = employee.cost.minus(employee.assigned);
    employee.excessUnits = maxDec(ZERO, employee.requiredUnits.minus(employee.plannedUnits));
    if (employee.excessUnits.gt(0)) {
      capacity = true;
      issues.push(`${employee.name}: se superan las porciones mensuales previstas.`);
    }
    if (employee.excess.gt(0)) {
      capacity = true;
      issues.push(`${employee.name}: capacidad excedida en ${decimalText(employee.excess)} minutos.`);
    }
  }

  if (!concepts.some((c) => c.kind === "cif") && !data.noCif) issues.push("Faltan CIF o declarar expresamente que no aplican.");
  if (!concepts.some((c) => c.kind !== "cif") && !data.noExpenses) issues.push("Faltan gastos o declarar expresamente que no aplican.");
  if (data.noCif && concepts.some((c) => c.kind === "cif" && !c.amount.isZero())) {
    issues.push("Hay CIF positivos: retira la declaración de que no aplican.");
  }
  if (data.noExpenses && concepts.some((c) => c.kind !== "cif" && !c.amount.isZero())) {
    issues.push("Hay gastos positivos: retira la declaración de que no aplican.");
  }

  const allocations: PlanAllocation[] = [];
  let unassigned = ZERO;
  for (const concept of concepts) {
    const bases = new Map<Key, Dec>();
    for (const line of data.lines) {
      if (concept.targets.length && !concept.targets.some((t) => sameKey(t, line.productId))) continue;
      const value =
        concept.basis === "equivalent"
          ? new D(line.equivalentFactor)
          : concept.basis === "mod"
            ? rows.get(line.id)!.minutes
            : new D(line.referencePrice);
      bases.set(line.id, quantities.get(line.id)!.times(value));
    }
    const allocated = allocation(concept.amount, bases);
    for (const [key, amount] of allocated.exact) {
      const row = rows.get(key)!;
      if (concept.kind === "cif") row.cif = row.cif.plus(amount);
      else row.expenses = row.expenses.plus(amount);
      if (concept.kind === "admin") row.admin = row.admin.plus(amount);
      else if (concept.kind === "sales") row.selling = row.selling.plus(amount);
      else if (concept.kind === "finance") row.finance = row.finance.plus(amount);
    }
    unassigned = unassigned.plus(allocated.unassigned);
    if (!allocated.unassigned.isZero()) issues.push(`${concept.name}: importe positivo sin base de asignación.`);
    allocations.push({ ...concept, ...allocated, bases });
  }

  for (const line of data.lines) {
    const row = rows.get(line.id)!;
    const quantity = quantities.get(line.id)!;
    if (quantity.isZero()) continue;
    row.production = row.cmp.plus(row.mod).plus(row.cif.div(quantity));
    row.complete = row.production.plus(row.expenses.div(quantity));
    if (line.tax === null || line.tax === undefined) {
      issues.push(`${line.name}: falta configurar el impuesto del periodo o producto.`);
    } else if (!line.pricePending) {
      row.price = price(row.complete, line.pricingMode, line.pricingValue, line.tax, line.adoptedPrice);
    }
  }

  const rowList = [...rows.values()];
  const staffList = [...staff.values()];
  const cmp = sum(rowList.map((r) => r.cmp.times(r.quantity)));
  const modAvailable = sum(staffList.map((s) => s.cost));
  const modAssigned = sum(staffList.map((s) => s.assigned));
  const byKind = (pred: (k: ConceptKind) => boolean) => sum(concepts.filter((c) => pred(c.kind)).map((c) => c.amount));
  const cif = byKind((k) => k === "cif");
  const expenses = byKind((k) => k !== "cif");
  const sales = sum(rowList.filter((r) => r.price).map((r) => r.quantity.times(r.price!.net)));
  const full = sum(rowList.filter((r) => r.complete !== null).map((r) => r.quantity.times(r.complete!)));
  const costs = cmp.plus(modAvailable).plus(cif).plus(expenses);
  const bridge = full.plus(modAvailable.minus(modAssigned)).plus(unassigned);
  const difference = costs.minus(bridge);
  if (difference.abs().gt("0.00000001")) issues.push("La conciliación de costos no coincide; revisa las entradas.");

  const uniqueIssues = [...new Set(issues)];
  const hasIssues = issues.length > 0;
  return {
    engine: ENGINE,
    status: capacity
      ? "capacidad_excedida"
      : !unassigned.isZero()
        ? "sin_base_asignacion"
        : hasIssues
          ? "incompleto"
          : "calculable",
    issues: uniqueIssues,
    rows: rowList,
    staff: staffList,
    allocations,
    requirements: [...requirements.values()],
    totals: {
      cmp,
      modAvailable,
      modAssigned,
      idle: modAvailable.minus(modAssigned),
      cif,
      expenses,
      admin: byKind((k) => k === "admin"),
      selling: byKind((k) => k === "sales"),
      finance: byKind((k) => k === "finance"),
      production: cmp.plus(modAssigned).plus(cif),
      unassigned,
      completeAssigned: full,
      costs,
      sales,
      profit: hasIssues ? null : sales.minus(costs),
      margin: !sales.isZero() && !hasIssues ? sales.minus(costs).div(sales) : null,
      bridge,
      difference,
    },
  };
}
