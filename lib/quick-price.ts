// Costo rápido (nivel 1): precio sugerido a partir del costo de insumos por porción.
// No inventa fórmulas: usa price() del motor con la modalidad «food_cost» (precio neto = costo ÷ food cost objetivo)
// y la modalidad «manual» para el food cost del precio de carta actual. Solo cuenta insumos: no incluye mano de obra ni gastos.
import { price } from "@/lib/costing/costing";
import { D, type Dec } from "@/lib/costing/decimal";

export const DEFAULT_FOOD_COST = 30;
export const FOOD_COST_MIN = 1;
export const FOOD_COST_MAX = 99;

/** Lee el porcentaje escrito por la persona ("30", "30,5", "30 %"). Devuelve el valor o un mensaje claro. */
export function parseFoodCostTarget(raw: unknown): { value: string } | { error: string } {
  const text = String(raw ?? "").replace("%", "").replace(",", ".").trim();
  const msg = `Escribe un porcentaje entre ${FOOD_COST_MIN} y ${FOOD_COST_MAX}. Por ejemplo: 30.`;
  if (!/^\d+(\.\d+)?$/.test(text)) return { error: msg };
  const n = new D(text);
  if (n.lt(FOOD_COST_MIN) || n.gt(FOOD_COST_MAX)) return { error: msg };
  return { value: n.toFixed() };
}

export type QuickPrice = {
  /** Precio de carta sugerido, con IGV (redondeado a céntimos). */
  gross: Dec;
  /** El mismo precio sin IGV. */
  net: Dec;
  /** Parte de cada sol vendido (sin IGV) que se va en insumos con el precio de carta actual; null si no hay precio. */
  currentRatio: Dec | null;
};

/** `perUnit` = costo de insumos por porción; `targetPct` = food cost objetivo en % (30 = 30 %); `igvRate` = fracción (0.18). */
export function quickPrice(perUnit: Dec | string, targetPct: string, igvRate: string, currentGross?: string | null): QuickPrice {
  const target = new D(targetPct).div(100);
  const suggested = price(perUnit, "food_cost", target, igvRate);
  const current = currentGross && new D(currentGross).gt(0) ? price(perUnit, "manual", currentGross, igvRate).costRatio : null;
  return { gross: suggested.final, net: suggested.net, currentRatio: current };
}

export const percentText = (d: Dec | null) => (d ? `${d.times(100).toDecimalPlaces(1).toFixed()} %` : "—");
