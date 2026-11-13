// Línea del plan: cantidad, reparto y modalidad de precio (legacy: forms/planning.py PlanLineForm, routes plan_line).
import { D, decimalText } from "@/lib/costing/decimal";
import type { PricingMode } from "@/lib/costing/costing";
import { parseAmount } from "@/lib/materials";

export const PRICING_MODES: { value: PricingMode; label: string; field: string; hint: string }[] = [
  { value: "food_cost", label: "Food cost objetivo", field: "Food cost objetivo (%)", hint: "Precio neto = costo total ÷ food cost. 30 equivale a 30 %." },
  { value: "markup", label: "Recargo sobre el costo", field: "Recargo (%)", hint: "Precio neto = costo total × (1 + recargo)." },
  { value: "margin", label: "Margen sobre la venta", field: "Margen (%)", hint: "Precio neto = costo total ÷ (1 − margen). Menor que 100 %." },
  { value: "manual", label: "Precio manual", field: "Precio final con IGV", hint: "Fijas el precio de carta; el margen se recalcula y puede ser pérdida." },
];

export type PlanLineValues = {
  quantity: string;
  referencePrice: string;
  equivalentFactor: string;
  pricingMode: PricingMode;
  pricingValue: string;
  adoptedPrice: string | null;
};

export function parsePlanLine(v: Record<string, string>): { value: PlanLineValues } | { errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const get = (key: string, opts: { positive?: boolean; optional?: boolean } = {}) => {
    const raw = (v[key] ?? "").trim();
    if (opts.optional && !raw) return null;
    const parsed = parseAmount(raw, { positive: opts.positive });
    if ("error" in parsed) {
      errors[key] = parsed.error;
      return null;
    }
    return parsed.value;
  };
  const quantity = get("quantity", { positive: true });
  const referencePrice = get("referencePrice");
  const equivalentFactor = get("equivalentFactor", { positive: true });
  const adoptedPrice = get("adoptedPrice", { optional: true });
  const mode = v.pricingMode as PricingMode;
  if (!PRICING_MODES.some((m) => m.value === mode)) errors.pricingMode = "Elige la modalidad de precio.";
  const value = get("pricingValue");
  if (value !== null && mode === "food_cost" && !(new D(value).gt(0) && new D(value).lte(100))) {
    errors.pricingValue = "El food cost objetivo debe ser mayor que 0 y como máximo 100 %.";
  }
  if (value !== null && mode === "margin" && new D(value).gte(100)) errors.pricingValue = "El margen objetivo debe ser menor que 100 %.";
  if (Object.keys(errors).length) return { errors };
  return {
    value: {
      quantity: quantity!,
      referencePrice: referencePrice!,
      equivalentFactor: equivalentFactor!,
      pricingMode: mode,
      // Los objetivos se escriben en % y se guardan como fracción; el precio manual va tal cual.
      pricingValue: mode === "manual" ? value! : decimalText(new D(value!).div(100)),
      adoptedPrice,
    },
  };
}

/** Valor del formulario a partir de lo guardado (fracción → %). */
export const pricingInput = (mode: PricingMode, stored: string) => (mode === "manual" ? decimalText(stored) : decimalText(new D(stored).times(100)));
