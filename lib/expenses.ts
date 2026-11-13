// Gastos del mes (legacy: forms/planning.py ConceptForm y routes/planning.py concept_edit).
import { parseAmount } from "@/lib/materials";
import type { AllocationBasis, ConceptKind } from "@/lib/costing/costing";

export const KINDS: { value: ConceptKind; label: string; short: string }[] = [
  { value: "cif", label: "Costo indirecto de fabricación (CIF)", short: "CIF" },
  { value: "admin", label: "Gasto administrativo", short: "Administración" },
  { value: "sales", label: "Gasto de ventas", short: "Ventas" },
  { value: "finance", label: "Gastos financieros", short: "Financieros" },
  { value: "other", label: "Otros gastos operativos", short: "Otros" },
];

export const BASES: { value: AllocationBasis; label: string; hint: string }[] = [
  { value: "equivalent", label: "Unidades equivalentes", hint: "Porciones del plan × factor de equivalencia." },
  { value: "mod", label: "Minutos de mano de obra directa", hint: "Según los minutos que cada plato usa de MOD." },
  { value: "sales", label: "Ventas de referencia sin IGV", hint: "Según la venta de referencia de cada plato." },
];

export const BEHAVIORS = [
  { value: "fixed", label: "Fijo" },
  { value: "variable", label: "Variable" },
] as const;

/** Nombre o comprobante normalizado (legacy: " ".join(x.casefold().split())). */
export const normalize = (s: string) => s.toLocaleLowerCase("es").split(/\s+/).filter(Boolean).join(" ");

export interface ConceptValues {
  name: string;
  referenceKey: string;
  kind: ConceptKind;
  amount: string;
  behavior: "fixed" | "variable";
  basis: AllocationBasis;
  justification: string;
  targets: number[];
  active: boolean;
}

export function parseConcept(input: Record<string, unknown> & { targets?: unknown[] }): { value: ConceptValues } | { errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const name = String(input.name ?? "").trim();
  const reference = String(input.referenceKey ?? "").trim();
  const justification = String(input.justification ?? "").trim();
  const kind = String(input.kind ?? "") as ConceptKind;
  const basis = String(input.basis ?? "") as AllocationBasis;
  const behavior = String(input.behavior ?? "") as ConceptValues["behavior"];
  if (!name) errors.name = "Escribe el concepto.";
  else if (name.length > 180) errors.name = "Usa hasta 180 caracteres.";
  if (reference.length > 180) errors.referenceKey = "Usa hasta 180 caracteres.";
  if (!KINDS.some((k) => k.value === kind)) errors.kind = "Elige la clasificación.";
  if (!BASES.some((b) => b.value === basis)) errors.basis = "Elige la base de distribución.";
  if (!BEHAVIORS.some((b) => b.value === behavior)) errors.behavior = "Elige si es fijo o variable.";
  if (!justification) errors.justification = "Explica el origen del importe y por qué esa base.";
  else if (justification.length > 500) errors.justification = "Usa hasta 500 caracteres.";
  const amount = parseAmount(input.amount);
  if ("error" in amount) errors.amount = amount.error;
  const targets = [...new Set((input.targets ?? []).map(Number))];
  if (targets.some((t) => !Number.isInteger(t) || t <= 0)) errors.targets = "Platos inválidos.";
  if (Object.keys(errors).length) return { errors };
  return {
    value: {
      name,
      // La referencia guardada es el comprobante normalizado o, si no hay, el nombre (legacy: reference).
      referenceKey: normalize(reference || name),
      kind,
      amount: (amount as { value: string }).value,
      behavior,
      basis,
      justification,
      targets,
      active: input.active === true || input.active === "on",
    },
  };
}
