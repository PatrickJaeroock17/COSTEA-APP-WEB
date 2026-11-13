// Demanda simulada de la carta y alerta de stock bajo (legacy: services/inventory_sources.py
// recipe_requirements + simulated_recipe_outputs, routes/inventory.py stock_alert). No mueve existencias.
import { D, type Dec, type Key, ZERO } from "@/lib/costing/decimal";
import { calculateLine, type QuantityMode } from "@/lib/costing/recipes";

export type DishRecipe = {
  dish: string;
  lines: { materialId: Key; quantity: string; factor: string; mode: QuantityMode; rate: string }[];
};

/** Un lote de la receta vigente de cada plato activo, sumado por insumo (cantidad bruta en unidad base). */
export function recipeRequirements(dishes: DishRecipe[]): Map<string, { quantity: Dec; dishes: string[] }> {
  const totals = new Map<string, { quantity: Dec; dishes: string[] }>();
  for (const d of dishes) {
    for (const l of d.lines) {
      const gross = calculateLine({ quantity: l.quantity, factor: l.factor, unitCost: "0", mode: l.mode, rate: l.rate }).grossQuantity;
      const key = String(l.materialId);
      const row = totals.get(key) ?? { quantity: ZERO, dishes: [] };
      row.quantity = row.quantity.plus(gross);
      if (!row.dishes.includes(d.dish)) row.dishes.push(d.dish);
      totals.set(key, row);
    }
  }
  return totals;
}

export type Simulation = {
  needed: Dec;
  /** Costo de la salida simulada al promedio vigente; null si el kardex no alcanza o está pendiente. */
  unitCost: Dec | null;
  cost: Dec | null;
  projectedQuantity: Dec;
  projectedValue: Dec | null;
  projectedAverage: Dec | null;
  /** Alerta: la existencia real alcanza o cae por debajo de un lote de cada plato que usa el insumo. */
  low: boolean;
  missing: Dec;
};

/** Salida simulada de un lote de cada plato sobre el saldo actual del kardex. */
export function simulateOutput(balance: { quantity: Dec; value: Dec | null } | null, needed: Dec): Simulation {
  const quantity = balance?.quantity ?? ZERO;
  const value = balance ? balance.value : ZERO;
  const average = value !== null && quantity.gt(0) ? value.div(quantity) : null;
  let unitCost: Dec | null = null;
  let cost: Dec | null = null;
  let projectedValue: Dec | null = null;
  if (value !== null && needed.lte(quantity)) {
    unitCost = average;
    cost = needed.eq(quantity) ? value : needed.times(average ?? ZERO);
    projectedValue = value.minus(cost);
  }
  const projectedQuantity = quantity.minus(needed);
  return {
    needed,
    unitCost,
    cost,
    projectedQuantity,
    projectedValue,
    projectedAverage: projectedValue !== null ? (projectedQuantity.gt(0) ? projectedValue.div(projectedQuantity) : ZERO) : null,
    low: quantity.lte(needed),
    missing: needed.gt(quantity) ? needed.minus(quantity) : new D(0),
  };
}
