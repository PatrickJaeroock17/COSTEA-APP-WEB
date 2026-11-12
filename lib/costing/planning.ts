// legacy: services/planning.py (payroll_input) — convierte el JSON guardado en employee_period_costs
// en la entrada del motor. El JSON conserva las claves del original (snake_case).
import type { Key, Num } from "./decimal";
import type { AllocationBasis, DirectBasis, StaffInput } from "./costing";
import { type PayrollInputs, monthlyPayroll } from "./payroll";

export interface EmployeePeriodCostData {
  components: { name: string; amount: string; source: string }[];
  fractions: { mod: string; cif: string; admin: string; sales: string };
  days: string;
  hours: string;
  excluded: string;
  productive: string;
  basis: AllocationBasis;
  direct_basis?: DirectBasis;
  planned_units?: string;
  justification: string;
}

export interface EmployeePeriodCostRecord {
  employeeId: Key;
  employee: { name: string; role?: string };
  data: EmployeePeriodCostData;
  /** Planilla detallada; si existe, sus componentes reemplazan a los guardados. */
  breakdown?: { inputs: PayrollInputs } | null;
}

export function payrollInput(record: EmployeePeriodCostRecord): StaffInput & { breakdown: unknown } {
  const raw = record.data;
  const components: { name: string; amount: Num; source: string }[] = record.breakdown
    ? monthlyPayroll(record.breakdown.inputs).components.map((c) => ({
        name: c.name,
        amount: c.amount,
        source: raw.components[0]?.source ?? "",
      }))
    : raw.components;
  return {
    id: record.employeeId,
    name: record.employee.name,
    role: record.employee.role,
    components,
    breakdown: record.breakdown ?? null,
    fractions: { ...raw.fractions },
    days: raw.days,
    hours: raw.hours,
    excluded: raw.excluded,
    productive: raw.productive,
    basis: raw.basis,
    directBasis: raw.direct_basis ?? "time",
    plannedUnits: raw.planned_units ?? "0",
    justification: raw.justification,
  };
}
