// legacy: services/materials.py — costo de adquisición exacto y versión vigente por fecha.
import { type Dec, type Num, nonnegative } from "./decimal";

export interface AcquisitionCost {
  baseQuantity: Dec;
  acquisitionAmount: Dec;
  unitCost: Dec;
  recoverableTax: Dec;
}

/**
 * Costo unitario en unidad base. El IGV recuperable se guarda aparte y NO entra al costo;
 * el impuesto no recuperable y los costos atribuibles sí.
 */
export function acquisitionCost(
  quantity: Num,
  factor: Num,
  netAmount: Num,
  nonrecoverableTax: Num,
  attributableCost: Num,
  recoverableTax: Num,
): AcquisitionCost {
  const [q, f, net, nonrec, attr, rec] = [quantity, factor, netAmount, nonrecoverableTax, attributableCost, recoverableTax].map(
    nonnegative,
  );
  if (q.isZero() || f.isZero()) throw new Error("La cantidad y el factor deben ser mayores que cero.");
  const baseQuantity = q.times(f);
  const amount = net.plus(nonrec).plus(attr);
  return { baseQuantity, acquisitionAmount: amount, unitCost: amount.div(baseQuantity), recoverableTax: rec };
}

/** Versión de precio de un insumo (tabla material_cost_versions). */
export type CostVersion =
  | { id: number; effectiveOn: string; mode: "direct"; unitCost: Num }
  | {
      id: number;
      effectiveOn: string;
      mode: "purchase";
      quantity: Num;
      factor: Num;
      netAmount: Num;
      nonrecoverableTax: Num;
      attributableCost: Num;
      recoverableTax: Num;
    };

export function versionResult(version: CostVersion): Dec {
  if (version.mode === "direct") return nonnegative(version.unitCost);
  return acquisitionCost(
    version.quantity,
    version.factor,
    version.netAmount,
    version.nonrecoverableTax,
    version.attributableCost,
    version.recoverableTax,
  ).unitCost;
}

/** Versión vigente a una fecha ISO (YYYY-MM-DD): la de fecha más reciente ≤ fecha; empate → mayor id. */
export function effectiveVersion<T extends { id: number; effectiveOn: string }>(versions: T[], onDate: string): T | null {
  let best: T | null = null;
  for (const v of versions) {
    if (v.effectiveOn > onDate) continue;
    if (!best || v.effectiveOn > best.effectiveOn || (v.effectiveOn === best.effectiveOn && v.id > best.id)) best = v;
  }
  return best;
}

