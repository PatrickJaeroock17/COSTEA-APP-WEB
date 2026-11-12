// legacy: services/units.py — conversión dimensional con factores racionales exactos (tabla units).
import { D, type Dec, type Num, nonnegative } from "./decimal";

export interface Unit {
  dimension: string;
  /** Factor a la unidad base = numerator / denominator. */
  numerator: number | string;
  denominator: number | string;
}

export function convertQuantity(quantity: Num, source: Unit, target: Unit): Dec {
  let q: Dec;
  try {
    q = nonnegative(quantity);
  } catch {
    throw new Error("La cantidad debe ser decimal, finita y no negativa.");
  }
  if (source.dimension !== target.dimension) {
    throw new Error("Estas unidades no tienen una conversión universal compatible.");
  }
  const sourceFactor = new D(source.numerator).div(source.denominator);
  const targetFactor = new D(target.numerator).div(target.denominator);
  return q.times(sourceFactor).div(targetFactor);
}
