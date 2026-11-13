// Costo mensual del trabajador (legacy: forms/planning.py PayrollForm y routes/planning.py monthly_form_data).
// Sin dependencias de servidor: lo usan la acción, el formulario (vista previa) y las pruebas.
import { D, decimalText } from "@/lib/costing/decimal";
import { type LaborCost, laborCost } from "@/lib/costing/costing";
import { PAYROLL_FIELDS, type PayrollInputs, type PayrollResult, monthlyPayroll } from "@/lib/costing/payroll";
import { plain } from "@/lib/costing/decimal";
import type { EmployeePeriodCostData } from "@/lib/costing/planning";
import { parseAmount } from "@/lib/materials";

export const BASIS = [
  { value: "equivalent", label: "Unidades equivalentes" },
  { value: "mod", label: "Minutos MOD" },
  { value: "sales", label: "Ventas de referencia sin impuesto" },
] as const;

/** Componentes del modo consolidado (legacy: names). */
export const CONSOLIDATED = [
  { key: "salary", label: "Remuneración" },
  { key: "allowances", label: "Asignaciones" },
  { key: "provisions", label: "Provisiones de beneficios" },
  { key: "charges", label: "Cargas patronales" },
  { key: "other", label: "Otros componentes" },
] as const;

/** Campos del desglose detallado con su etiqueta y valor por defecto (legacy: PayrollForm). */
export const DETAILED: { key: (typeof PAYROLL_FIELDS)[number]; label: string; default: string; optional?: boolean; hint?: string }[] = [
  { key: "salary", label: "Sueldo básico mensual", default: "" },
  { key: "bonuses", label: "Bonificaciones mensuales", default: "0" },
  { key: "family_allowance", label: "Asignación familiar mensual", default: "0" },
  { key: "gratification_july", label: "Gratificación de julio (anual)", default: "0", hint: "Se provisiona en 12 meses." },
  { key: "gratification_december", label: "Gratificación de diciembre (anual)", default: "0", hint: "Se provisiona en 12 meses." },
  { key: "cts_annual", label: "CTS total anual", default: "0", hint: "Se provisiona en 12 meses." },
  { key: "extraordinary_percent", label: "Bonificación extraordinaria (%)", default: "9", hint: "Sobre las gratificaciones." },
  { key: "essalud_percent", label: "EsSalud (%)", default: "9" },
  { key: "essalud_base", label: "Base EsSalud (opcional)", default: "", optional: true, hint: "Vacío: sueldo + bonificaciones + asignación." },
  { key: "essalud_minimum_base", label: "Base mínima EsSalud", default: "0", hint: "0 si no aplica." },
  { key: "sctr_percent", label: "SCTR (%)", default: "0" },
  { key: "sctr_base", label: "Base SCTR (opcional)", default: "", optional: true, hint: "Vacío: sueldo + bonificaciones + asignación." },
  { key: "eps_monthly", label: "Prima EPS mensual del empleador", default: "0" },
  { key: "eps_credit", label: "Crédito EPS contra EsSalud", default: "0" },
  { key: "other", label: "Otros costos mensuales", default: "0" },
];

export type PayrollFormValues = Record<string, string>;

export const PAYROLL_DEFAULTS: PayrollFormValues = {
  mode: "detailed",
  ...Object.fromEntries(DETAILED.map((f) => [f.key, f.default])),
  allowances: "0",
  provisions: "0",
  charges: "0",
  source: "",
  days: "26",
  hours: "8",
  excluded: "0",
  productive: "100",
  mod: "100",
  cif: "0",
  admin: "0",
  sales: "0",
  basis: "equivalent",
  justification: "",
  direct_basis: "time",
  planned_units: "0",
};

export type ParsedPayroll = {
  data: EmployeePeriodCostData;
  breakdown: Record<string, unknown> | null;
  result: LaborCost;
  payroll: PayrollResult | null;
};

const pct = (value: string) => decimalText(new D(value).div(100));

/** Valida el formulario y arma el JSON que se guarda (data + breakdown). */
export function parsePayroll(v: PayrollFormValues): { ok: ParsedPayroll } | { errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const num = (key: string, opts: { positive?: boolean; optional?: boolean } = {}) => {
    const raw = (v[key] ?? "").trim();
    if (opts.optional && !raw) return null;
    const parsed = parseAmount(raw, { positive: opts.positive });
    if ("error" in parsed) {
      errors[key] = parsed.error;
      return null;
    }
    return parsed.value;
  };
  const mode = v.mode === "consolidated" ? "consolidated" : "detailed";
  const source = (v.source ?? "").trim();
  const justification = (v.justification ?? "").trim();
  if (!source) errors.source = "Indica el sustento y la composición de los importes.";
  else if (source.length > 500) errors.source = "Usa hasta 500 caracteres.";
  if (!justification) errors.justification = "Justifica la distribución.";
  else if (justification.length > 500) errors.justification = "Usa hasta 500 caracteres.";

  const days = num("days");
  const hours = num("hours");
  const excluded = num("excluded");
  const productive = num("productive");
  const fractions = { mod: num("mod"), cif: num("cif"), admin: num("admin"), sales: num("sales") };
  const directBasis = v.direct_basis === "quantity" ? "quantity" : "time";
  // Porciones previstas: solo las ingresa el usuario cuando reparte por porciones (el campo solo se
  // muestra entonces). Con reparto por minutos no se lee y se guarda 0 (legacy: default "0").
  const plannedUnits = directBasis === "quantity" ? num("planned_units") : "0";
  if (productive && new D(productive).gt(100)) errors.productive = "Debe estar entre 0 y 100 %.";
  if (Object.values(fractions).every(Boolean) && !Object.values(fractions).reduce((a, b) => a.plus(b!), new D(0)).eq(100)) {
    errors.sales = "Las cuatro distribuciones deben sumar exactamente 100 %.";
  }
  if (days && hours && excluded && new D(excluded).gt(new D(days).times(hours).times(60))) {
    errors.excluded = "No puede superar los minutos programados del mes.";
  }
  if (directBasis === "quantity" && plannedUnits && new D(plannedUnits).isZero()) {
    errors.planned_units = "Indica cuántas porciones produce el trabajador en el mes.";
  }
  if (!BASIS.some((b) => b.value === v.basis)) errors.basis = "Elige una base de distribución.";

  let components: { name: string; amount: string; source: string }[] = [];
  let payroll: PayrollResult | null = null;
  if (mode === "detailed") {
    const inputs: PayrollInputs = {};
    for (const f of DETAILED) inputs[f.key] = num(f.key, { optional: f.optional });
    if (!Object.keys(errors).some((k) => DETAILED.some((f) => f.key === k))) {
      try {
        payroll = monthlyPayroll(inputs);
        components = payroll.components.map((c) => ({ name: c.name, amount: decimalText(c.amount), source }));
      } catch (e) {
        errors.mode = (e as Error).message;
      }
    }
  } else {
    components = CONSOLIDATED.map((c) => ({ name: c.label, amount: num(c.key) ?? "0", source }));
  }
  if (Object.keys(errors).length) return { errors };

  const data: EmployeePeriodCostData = {
    components,
    fractions: { mod: pct(fractions.mod!), cif: pct(fractions.cif!), admin: pct(fractions.admin!), sales: pct(fractions.sales!) },
    days: days!,
    hours: hours!,
    excluded: excluded!,
    productive: pct(productive!),
    basis: v.basis as EmployeePeriodCostData["basis"],
    direct_basis: directBasis,
    planned_units: plannedUnits!,
    justification,
  };
  let result: LaborCost;
  try {
    result = laborCost({ id: 0, name: "", ...data, directBasis: data.direct_basis, plannedUnits: data.planned_units });
  } catch (e) {
    return { errors: { mode: (e as Error).message } };
  }
  return { ok: { data, breakdown: payroll ? (plain(payroll) as Record<string, unknown>) : null, result, payroll } };
}

/** Etiqueta visible de cada campo del formulario, para nombrarlo en los mensajes de error. */
export const PAYROLL_LABELS: Record<string, string> = {
  mode: "Cálculo de planilla",
  source: "Sustento y composición de los importes",
  days: "Días programados",
  hours: "Horas por día",
  excluded: "Minutos excluidos",
  productive: "Factor productivo (%)",
  mod: "Mano de obra directa (%)",
  cif: "CIF (%)",
  admin: "Administración (%)",
  sales: "Distribución del costo (debe sumar 100 %)",
  basis: "Base para repartir la parte indirecta",
  justification: "Justificación de la distribución",
  direct_basis: "Cómo repartir el trabajo directo",
  planned_units: "Porciones mensuales previstas",
};

/** Mensaje general que nombra los campos con error (nunca "datos marcados" sin decir cuáles). */
export function payrollErrorMessage(errors: Record<string, string>, mode = "detailed"): string {
  if (errors.mode && Object.keys(errors).length === 1) return errors.mode;
  // Los importes se llaman distinto según el modo visible (p. ej. salary: "Sueldo básico mensual" o "Remuneración").
  const amounts: { key: string; label: string }[] = mode === "consolidated" ? [...CONSOLIDATED] : DETAILED;
  const label = (k: string) => amounts.find((f) => f.key === k)?.label ?? PAYROLL_LABELS[k] ?? k;
  const names = Object.keys(errors).map(label);
  return `Revisa ${names.length === 1 ? "este dato" : "estos datos"}: ${names.join(", ")}.`;
}

/** Valores del formulario a partir de lo guardado (legacy: GET de payroll()). */
export function payrollFormValues(saved: { data: EmployeePeriodCostData; breakdown: { inputs: Record<string, string | null> } | null } | null): PayrollFormValues {
  if (!saved) return { ...PAYROLL_DEFAULTS };
  const { data, breakdown } = saved;
  const values: PayrollFormValues = {
    ...PAYROLL_DEFAULTS,
    mode: breakdown ? "detailed" : "consolidated",
    source: data.components[0]?.source ?? "",
    days: data.days,
    hours: data.hours,
    excluded: data.excluded,
    productive: decimalText(new D(data.productive).times(100)),
    mod: decimalText(new D(data.fractions.mod).times(100)),
    cif: decimalText(new D(data.fractions.cif).times(100)),
    admin: decimalText(new D(data.fractions.admin).times(100)),
    sales: decimalText(new D(data.fractions.sales).times(100)),
    basis: data.basis,
    justification: data.justification,
    direct_basis: data.direct_basis ?? "time",
    planned_units: data.planned_units ?? "0",
  };
  if (breakdown) {
    for (const [k, value] of Object.entries(breakdown.inputs)) values[k] = value ?? "";
  } else {
    CONSOLIDATED.forEach((c, i) => (values[c.key] = data.components[i]?.amount ?? "0"));
  }
  return values;
}
