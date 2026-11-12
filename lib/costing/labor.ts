// legacy: services/labor_table.py y worker_minutes.py — detalle de MOD por receta y minutos del mes
// con las mismas tarifas que usa el plan.
import { D, type Dec, type Key, type Num, ZERO, sum } from "./decimal";
import { type LaborCost, type StaffInput, laborCost } from "./costing";

export interface Operation {
  employeeId: Key;
  activity: string;
  minutes: Num;
}

export interface RecipeWork {
  operations: Operation[];
  noLabor: boolean;
}

export interface LaborTableRow {
  employee: { id: Key; name: string };
  salary: Dec | null;
  minutes: Dec;
  rate: Dec | null;
  amount: Dec | null;
  note: string;
  configured: boolean;
}

/**
 * @param employees trabajadores del restaurante
 * @param staff entradas de costo mensual del periodo (ver `payrollInput`), por trabajador
 * @param outputQuantity rendimiento del lote de la receta
 */
export function recipeLaborTable(
  employees: { id: Key; name: string }[],
  staff: StaffInput[],
  outputQuantity: Num,
  work: RecipeWork | null,
) {
  const output = new D(outputQuantity);
  const monthly = new Map(staff.map((s) => [String(s.id), s]));
  const operations = work?.operations ?? [];
  const rows: LaborTableRow[] = [];
  const issues: string[] = [];
  let total = ZERO;
  if (!operations.length && !work?.noLabor) {
    issues.push("Asigna los minutos de trabajo a esta receta o declara que no requiere MOD en Operaciones.");
  }
  if (operations.length && work?.noLabor) {
    issues.push("La receta tiene operaciones y una declaración sin MOD; revisa Operaciones.");
  }
  for (const employee of employees) {
    const assigned = operations.filter((op) => String(op.employeeId) === String(employee.id));
    const minutes = sum(assigned.map((op) => new D(op.minutes)));
    const record = monthly.get(String(employee.id));
    const cost: LaborCost | null = record ? laborCost(record) : null;
    let amount: Dec | null = assigned.length ? null : ZERO;
    let note = assigned.length ? "" : "Sin tiempo asignado a este plato";
    if (assigned.length) {
      if (!cost) {
        issues.push(`${employee.name}: falta configurar el costo mensual.`);
      } else if (cost.directBasis === "quantity") {
        note = "Reparto por porciones; no utiliza tarifa por minuto";
        if (cost.unitRate === null) issues.push(`${employee.name}: faltan las porciones mensuales previstas.`);
        else amount = cost.unitRate.times(output);
      } else if (cost.rate === null) {
        issues.push(`${employee.name}: faltan minutos MOD disponibles en el mes.`);
      } else if (assigned.some((op) => new D(op.minutes).lte(0))) {
        issues.push(`${employee.name}: completa los minutos positivos de sus operaciones.`);
      } else {
        amount = minutes.times(cost.rate);
      }
    }
    if (amount !== null) total = total.plus(amount);
    rows.push({
      employee,
      salary: cost ? cost.total : null,
      minutes,
      rate: cost && cost.directBasis === "time" ? cost.rate : null,
      amount,
      note,
      configured: Boolean(record),
    });
  }
  const known = new Set(employees.map((e) => String(e.id)));
  if (operations.some((op) => !known.has(String(op.employeeId)))) {
    issues.push("La receta tiene un trabajador no disponible en este restaurante.");
  }
  return {
    rows,
    issues,
    total: issues.length ? null : total,
    perPortion: issues.length ? null : total.div(output),
  };
}

export interface WorkerMinutes {
  salary: Dec;
  programmed: Dec;
  productive: Dec;
  effective: Dec;
  /** Costo total ÷ minutos efectivos (antes del reparto MOD/indirecto); null si no hay minutos. */
  rate: Dec | null;
  excluded: Dec;
  days: Dec;
  hours: Dec;
  byQuantity: boolean;
}

/** Fila de la tabla de minutos del mes de un trabajador con costo configurado. */
export function workerMinutes(data: StaffInput): WorkerMinutes {
  const cost = laborCost(data);
  const days = new D(data.days);
  const hours = new D(data.hours);
  const excluded = new D(data.excluded);
  const productive = new D(data.productive);
  const programmed = days.times(hours).times(60);
  const effective = programmed.minus(excluded).times(productive);
  return {
    salary: cost.total,
    programmed,
    productive,
    effective,
    rate: effective.isZero() ? null : cost.total.div(effective),
    excluded,
    days,
    hours,
    byQuantity: cost.directBasis === "quantity",
  };
}
