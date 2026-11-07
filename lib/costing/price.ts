import Decimal from "decimal.js";

// Precisión y redondeo del motor de costos (el original usa Decimal exacto).
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export const IGV = new Decimal("0.18");

const cents = (d: Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

/**
 * Precio por modalidad "margen" (legacy: services/costing.py → price()):
 *   neto = costo / (1 − margen)
 *   sugerido = neto × (1 + IGV)
 *   margen real = (neto − costo) / neto
 * Fase 4 portará el resto de modalidades y las pruebas; esto es lo mínimo que usa la landing.
 */
export function priceFromMargin(cost: Decimal.Value, margin: Decimal.Value, tax: Decimal.Value = IGV) {
  const c = new Decimal(cost);
  const m = new Decimal(margin);
  const t = new Decimal(tax);
  if (c.isNegative() || m.isNegative() || m.gte(1) || t.isNegative() || t.gt(1)) {
    throw new Error("Costo, margen o tasa inválidos.");
  }
  const net = c.div(new Decimal(1).minus(m));
  const suggested = net.times(t.plus(1));
  const final = cents(suggested);
  const netFinal = final.div(t.plus(1));
  return {
    suggested,
    final,
    net: cents(netFinal),
    tax: cents(final.minus(netFinal)),
    result: cents(netFinal.minus(c)),
    margin: netFinal.isZero() ? null : netFinal.minus(c).div(netFinal),
  };
}

/** Promedio ponderado móvil tras una entrada (INVENTARIOS.md). */
export function movingAverage(stock: Decimal.Value, avg: Decimal.Value, inQty: Decimal.Value, inCost: Decimal.Value) {
  const s = new Decimal(stock);
  const q = new Decimal(inQty);
  const total = s.plus(q);
  if (total.isZero()) return new Decimal(avg);
  return s.times(avg).plus(q.times(inCost)).div(total);
}

export const money = (d: Decimal.Value) => `S/ ${cents(new Decimal(d)).toFixed(2)}`;
