// legacy: services/payroll.py — costo mensual del empleador.
// Beneficios anuales se provisionan en 12 meses. Bases y tasas son explícitas porque los regímenes difieren.
// Es un presupuesto de costo, no una declaración de planilla. El crédito EPS se resta de EsSalud una sola vez.
import { type Dec, type Num, maxDec, nonnegative, sum } from "./decimal";

export const PAYROLL_FIELDS = [
  "salary",
  "bonuses",
  "family_allowance",
  "gratification_july",
  "gratification_december",
  "cts_annual",
  "extraordinary_percent",
  "essalud_percent",
  "essalud_base",
  "essalud_minimum_base",
  "sctr_percent",
  "sctr_base",
  "eps_monthly",
  "eps_credit",
  "other",
] as const;
export type PayrollField = (typeof PAYROLL_FIELDS)[number];
const OPTIONAL_BASES = new Set<PayrollField>(["essalud_base", "sctr_base"]);

export type PayrollInputs = Partial<Record<PayrollField, Num | null>>;

export interface PayrollComponent {
  key: string;
  name: string;
  amount: Dec;
}

export interface PayrollResult {
  schemaVersion: 1;
  inputs: Record<PayrollField, Dec | null>;
  essaludBaseApplied: Dec;
  sctrBaseApplied: Dec;
  essaludGross: Dec;
  components: PayrollComponent[];
  total: Dec;
}

export function monthlyPayroll(inputs: PayrollInputs): PayrollResult {
  const values = {} as Record<PayrollField, Dec | null>;
  for (const key of PAYROLL_FIELDS) {
    const raw = inputs[key];
    if ((raw === null || raw === undefined) && OPTIONAL_BASES.has(key)) {
      values[key] = null;
      continue;
    }
    if (raw === null || raw === undefined) throw new Error(`Falta el dato de planilla: ${key}.`);
    try {
      values[key] = nonnegative(raw);
    } catch {
      throw new Error(`Importe de planilla inválido: ${key}.`);
    }
  }
  const v = (k: PayrollField) => values[k] as Dec;
  for (const key of ["essalud_percent", "sctr_percent", "extraordinary_percent"] as const) {
    if (v(key).gt(100)) throw new Error("Las tasas de planilla deben estar entre 0 y 100 %.");
  }
  const remuneration = v("salary").plus(v("bonuses")).plus(v("family_allowance"));
  const base = maxDec(values.essalud_base ?? remuneration, v("essalud_minimum_base"));
  const sctrBase = values.sctr_base ?? remuneration;
  const essalud = base.times(v("essalud_percent")).div(100);
  const epsCap = essalud.lt(v("eps_monthly")) ? essalud : v("eps_monthly");
  if (v("eps_credit").gt(epsCap)) {
    throw new Error("El crédito EPS no puede superar EsSalud ni la prima EPS mensual.");
  }
  const july = v("gratification_july").div(12);
  const december = v("gratification_december").div(12);
  const components: PayrollComponent[] = [
    { key: "salary", name: "Sueldo básico", amount: v("salary") },
    { key: "bonuses", name: "Bonificaciones mensuales", amount: v("bonuses") },
    { key: "family_allowance", name: "Asignación familiar", amount: v("family_allowance") },
    { key: "gratification_july", name: "Provisión gratificación julio", amount: july },
    { key: "gratification_december", name: "Provisión gratificación diciembre", amount: december },
    { key: "cts", name: "Provisión CTS", amount: v("cts_annual").div(12) },
    {
      key: "extraordinary",
      name: "Bonificación extraordinaria de gratificaciones",
      amount: july.plus(december).times(v("extraordinary_percent")).div(100),
    },
    { key: "essalud", name: "EsSalud neto de crédito EPS", amount: essalud.minus(v("eps_credit")) },
    { key: "sctr", name: "SCTR", amount: sctrBase.times(v("sctr_percent")).div(100) },
    { key: "eps", name: "EPS mensual", amount: v("eps_monthly") },
    { key: "other", name: "Otros costos mensuales", amount: v("other") },
  ];
  return {
    schemaVersion: 1,
    inputs: values,
    essaludBaseApplied: base,
    sctrBaseApplied: sctrBase,
    essaludGross: essalud,
    components,
    total: sum(components.map((c) => c.amount)),
  };
}

