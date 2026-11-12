// legacy: services/recipes.py — costo de materiales de una receta, sin redondeo intermedio.
import { type Dec, type Num, ONE, nonnegative, sum } from "./decimal";

/** gross = cantidad bruta · loss = cantidad neta con merma (÷(1−m)) · additional = recargo (×(1+m)). */
export type QuantityMode = "gross" | "loss" | "additional";

export interface LineInput {
  quantity: Num;
  factor: Num;
  unitCost: Num;
  mode?: QuantityMode;
  rate?: Num;
}

export interface LineResult {
  baseQuantity: Dec;
  grossQuantity: Dec;
  amount: Dec;
  usableUnitCost: Dec;
  yieldRate: Dec | null;
}

export function calculateLine(line: LineInput): LineResult {
  const mode = line.mode ?? "gross";
  const [quantity, factor, unitCost, rate] = [line.quantity, line.factor, line.unitCost, line.rate ?? "0"].map(nonnegative);
  if (quantity.lte(0) || factor.lte(0)) throw new Error("La cantidad y el factor deben ser mayores que cero.");
  if (!["gross", "loss", "additional"].includes(mode)) throw new Error("Modo de cantidad inválido.");
  if (mode === "loss" && rate.gte(1)) throw new Error("La merma debe ser menor que 100 %.");
  if (mode === "gross" && !rate.isZero()) throw new Error("La cantidad bruta no admite merma adicional.");
  const base = quantity.times(factor);
  let gross = base;
  if (mode === "loss") gross = base.div(ONE.minus(rate));
  else if (mode === "additional") gross = base.times(ONE.plus(rate));
  const amount = gross.times(unitCost);
  return {
    baseQuantity: base,
    grossQuantity: gross,
    amount,
    usableUnitCost: amount.div(base),
    yieldRate: mode === "loss" ? ONE.minus(rate) : null,
  };
}

/** Totales de la receta: total del lote y costo por unidad de rendimiento. */
export function recipeTotals(lines: LineInput[], outputQuantity: Num): [LineResult[], Dec | null, Dec | null] {
  const output = nonnegative(outputQuantity);
  if (output.isZero()) throw new Error("El rendimiento debe ser mayor que cero.");
  const results = lines.map(calculateLine);
  if (!results.length) return [results, null, null];
  const total = sum(results.map((r) => r.amount));
  return [results, total, total.div(output)];
}

