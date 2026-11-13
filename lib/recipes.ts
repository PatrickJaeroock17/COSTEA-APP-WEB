// Reglas de recetas sin dependencias de servidor (legacy: forms/product.py y routes/products.py).
import { D } from "@/lib/costing/decimal";
import { convertQuantity } from "@/lib/costing/units";
import { decimalText } from "@/lib/costing/decimal";
import { parseAmount, type UnitRow } from "@/lib/materials";
import type { QuantityMode } from "@/lib/costing/recipes";

export const QUANTITY_MODES: { value: QuantityMode; label: string; hint: string }[] = [
  { value: "gross", label: "Cantidad bruta", hint: "Ya incluye lo que se pierde al preparar." },
  { value: "loss", label: "Neta con merma", hint: "Se compra más: cantidad ÷ (1 − merma)." },
  { value: "additional", label: "Neta con adicional", hint: "Se agrega un porcentaje: cantidad × (1 + %)." },
];

export interface LineSpec {
  material_id: number;
  cost_version_id: number;
  quantity: string;
  unit_key: string;
  mode: QuantityMode;
  rate: string;
}

/** legacy: QuantityForm — cantidad positiva, modo y merma/adicional en %. */
export function parseLine(input: Record<string, unknown>):
  | { value: Omit<LineSpec, "material_id" | "cost_version_id"> }
  | { errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const quantity = parseAmount(input.quantity, { positive: true });
  if ("error" in quantity) errors.quantity = quantity.error;
  const mode = String(input.mode ?? "") as QuantityMode;
  if (!QUANTITY_MODES.some((m) => m.value === mode)) errors.mode = "Elige cómo está expresada la cantidad.";
  const percent = parseAmount(String(input.percent ?? "").trim() || "0");
  if ("error" in percent) errors.percent = percent.error;
  else if (mode === "loss" && new D(percent.value).gte(100)) errors.percent = "La pérdida debe ser menor que 100 %.";
  else if (mode === "gross" && !new D(percent.value).isZero()) errors.percent = "En cantidad bruta, ingresa 0 para no duplicar la merma.";
  const unitKey = String(input.unitKey ?? "");
  if (!/^(unit|custom):[A-Za-z0-9_]+$/.test(unitKey)) errors.unitKey = "Elige la unidad de la cantidad usada.";
  if (Object.keys(errors).length) return { errors };
  return {
    value: {
      quantity: (quantity as { value: string }).value,
      unit_key: unitKey,
      mode,
      rate: decimalText(new D((percent as { value: string }).value).div(100)),
    },
  };
}

export interface ConsumptionOption {
  key: string;
  label: string;
  /** Unidades base por una unidad de consumo. */
  factor: string;
}

/** legacy: consumption_options — unidades físicas de la misma dimensión y presentaciones del insumo. */
export function consumptionOptions(
  base: UnitRow,
  units: UnitRow[],
  conversions: { id: number; label: string; factor: string }[],
): ConsumptionOption[] {
  return [
    ...units
      .filter((u) => u.dimension === base.dimension && u.dimension !== "time")
      .map((u) => ({ key: `unit:${u.code}`, label: `${u.name} (${u.symbol})`, factor: decimalText(convertQuantity("1", u, base)) })),
    ...conversions.map((c) => ({ key: `custom:${c.id}`, label: c.label, factor: decimalText(c.factor) })),
  ];
}

/** Porcentaje legible a partir de la tasa guardada (0.2 → "20"). */
export const ratePercent = (rate: string) => decimalText(new D(rate).times(100));
