// legacy: services/inventory.py — kardex con promedio ponderado móvil (parte pura, sin base de datos).
// Las entradas llevan su costo; las salidas se valoran al promedio vigente. Si una salida supera el
// stock, la valoración queda pendiente en vez de inventar existencias o costos.
import { D, type Dec, type Key, type Num, ZERO } from "./decimal";
import { type QuantityMode, calculateLine } from "./recipes";

export interface Movement {
  id: number;
  materialId: Key;
  /** Fecha ISO YYYY-MM-DD. */
  movementOn: string;
  kind: "in" | "out";
  quantity: Num;
  /** Costo unitario de la entrada; en salidas se ignora. */
  unitCost: Num;
  voided?: boolean;
}

export interface LedgerRow<M extends Movement = Movement> {
  movement: M;
  quantity: Dec;
  value: Dec | null;
  average: Dec | null;
  unitCost: Dec | null;
  cost: Dec | null;
}

/** Orden del kardex: fecha, entradas antes que salidas el mismo día, id. */
export function sortMovements<M extends Movement>(movements: M[]): M[] {
  return [...movements].sort(
    (a, b) =>
      (a.movementOn < b.movementOn ? -1 : a.movementOn > b.movementOn ? 1 : 0) ||
      (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0) ||
      a.id - b.id,
  );
}

/** Kardex de un insumo hasta `onDate` (incluida), sin movimientos anulados. */
export function ledger<M extends Movement>(movements: M[], onDate?: string): LedgerRow<M>[] {
  const list = sortMovements(movements.filter((m) => !m.voided && (onDate === undefined || m.movementOn <= onDate)));
  let quantity = ZERO;
  let value: Dec | null = ZERO;
  const rows: LedgerRow<M>[] = [];
  for (const movement of list) {
    const q = new D(movement.quantity);
    let unitCost: Dec | null;
    let cost: Dec | null;
    if (movement.kind === "in") {
      unitCost = new D(movement.unitCost);
      cost = q.times(unitCost);
      quantity = quantity.plus(q);
      if (value !== null) value = value.plus(cost);
    } else {
      if (q.gt(quantity) || value === null) {
        unitCost = cost = value = null;
      } else {
        unitCost = quantity.isZero() ? ZERO : value.div(quantity);
        cost = q.eq(quantity) ? value : q.times(unitCost);
      }
      quantity = quantity.minus(q);
      if (value !== null) value = value.minus(cost!);
    }
    rows.push({
      movement,
      quantity,
      value,
      average: value !== null ? (quantity.isZero() ? ZERO : value.div(quantity)) : null,
      unitCost,
      cost,
    });
  }
  return rows;
}

export type PriceSource = "catalog" | "pending" | "kardex";

/**
 * Último promedio utilizable. Sin entradas → se usa el precio de la receta ("catalog").
 * Con stock en cero, el último promedio valorado sigue sirviendo para estimar.
 */
export function inventoryPrice(movements: Movement[], onDate?: string): [Dec | null, PriceSource] {
  const rows = ledger(movements, onDate);
  if (!rows.some((r) => r.movement.kind === "in")) return [null, "catalog"];
  if (rows[rows.length - 1].value === null) return [null, "pending"];
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (row.average !== null && row.quantity.gt(0)) return [row.average, "kardex"];
  }
  return [null, "pending"];
}

export interface RecipeForStock {
  outputQuantity: Num;
  lines: { materialId: Key; quantity: Num; factor: Num; mode: QuantityMode; rate: Num }[];
}

/** Cantidades brutas de cada insumo para `outputQuantity` unidades de la receta. */
export function recipeQuantities(recipe: RecipeForStock, outputQuantity: Num): Map<string, Dec> {
  const quantities = new Map<string, Dec>();
  const output = new D(recipe.outputQuantity);
  for (const line of recipe.lines) {
    const gross = calculateLine({ quantity: line.quantity, factor: line.factor, unitCost: "0", mode: line.mode, rate: line.rate }).grossQuantity;
    const key = String(line.materialId);
    quantities.set(key, (quantities.get(key) ?? ZERO).plus(gross.times(outputQuantity).div(output)));
  }
  return quantities;
}

/** Disponible a una fecha considerando lo ya reservado por salidas posteriores (mínimo del saldo futuro). */
export function availableOn(movements: Movement[], onDate: string): Dec {
  const history = ledger(movements);
  let atDate = ZERO;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].movement.movementOn <= onDate) {
      atDate = history[i].quantity;
      break;
    }
  }
  return history
    .filter((r) => r.movement.movementOn > onDate)
    .reduce((min, r) => (r.quantity.lt(min) ? r.quantity : min), atDate);
}

export interface Shortage {
  materialId: string;
  needed: Dec;
  available: Dec;
}

/** Insumos insuficientes para consumir `quantities` en `onDate`. */
export function stockShortages(
  quantities: Map<string, Dec>,
  movementsOf: (materialId: string) => Movement[],
  onDate: string,
): Shortage[] {
  const shortages: Shortage[] = [];
  for (const [materialId, needed] of quantities) {
    const available = availableOn(movementsOf(materialId), onDate);
    if (available.lt(needed)) shortages.push({ materialId, needed, available });
  }
  return shortages;
}

/** Promedio ponderado móvil tras una entrada (INVENTARIOS.md). */
export function movingAverage(stock: Num, avg: Num, inQty: Num, inCost: Num): Dec {
  const s = new D(stock);
  const q = new D(inQty);
  const total = s.plus(q);
  if (total.isZero()) return new D(avg);
  return s.times(avg).plus(q.times(inCost)).div(total);
}
