// legacy: services/sales.py (summarize) — resultados reales del mes.
// Los precios de venta incluyen 18 % de IGV; los costos excluyen el impuesto recuperable.
import { D, type Dec, type Key, type Num, ONE, ZERO, compareKeys, sum } from "./decimal";

export const IGV = new D("0.18");

export interface SaleInput {
  productId: Key;
  productName: string;
  quantity: Num;
  /** Precio unitario con IGV. */
  unitPrice: Num;
  /** Costo de materiales unitario congelado al vender. */
  unitCost: Num;
}

export interface SalesRow {
  name: string;
  quantity: Dec;
  gross: Dec;
  materials: Dec;
  net: Dec;
  variable: Dec;
  contribution: Dec;
  fixed: Dec;
  profit: Dec;
}

export function summarize(sales: SaleInput[], fixed: Num = "0", otherVariable: Num = "0") {
  const fixedD = new D(fixed);
  const otherD = new D(otherVariable);
  const rows = new Map<string, SalesRow>();
  for (const sale of sales) {
    let row = rows.get(String(sale.productId));
    if (!row) {
      row = { name: sale.productName, quantity: ZERO, gross: ZERO, materials: ZERO, net: ZERO, variable: ZERO, contribution: ZERO, fixed: ZERO, profit: ZERO };
      rows.set(String(sale.productId), row);
    }
    const q = new D(sale.quantity);
    row.quantity = row.quantity.plus(q);
    row.gross = row.gross.plus(q.times(sale.unitPrice));
    row.materials = row.materials.plus(q.times(sale.unitCost));
  }
  const list = [...rows.values()];
  const gross = sum(list.map((r) => r.gross));
  const net = gross.div(ONE.plus(IGV));
  const materials = sum(list.map((r) => r.materials));
  const contribution = net.minus(materials).minus(otherD);
  const ratio = net.isZero() ? null : contribution.div(net);
  const equilibrium = ratio && ratio.gt(0) ? fixedD.div(ratio) : null;
  for (const row of list) {
    row.net = row.gross.div(ONE.plus(IGV));
    row.variable = row.materials.plus(net.isZero() ? ZERO : otherD.times(row.net).div(net));
    row.contribution = row.net.minus(row.variable);
    row.fixed = net.isZero() ? ZERO : fixedD.times(row.net).div(net);
    row.profit = row.contribution.minus(row.fixed);
  }
  list.sort((a, b) => b.quantity.cmp(a.quantity) || compareKeys(a.name, b.name));
  return {
    rows: list,
    gross,
    net,
    tax: gross.minus(net),
    materials,
    variable: materials.plus(otherD),
    fixed: fixedD,
    costs: materials.plus(otherD).plus(fixedD),
    profit: contribution.minus(fixedD),
    ratio,
    equilibrium,
    equilibriumGross: equilibrium ? equilibrium.times(ONE.plus(IGV)) : null,
  };
}
