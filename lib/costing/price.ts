// Atajos de presentación sobre el motor (los usa la landing). La lógica vive en costing.ts.
import { type Num, money } from "./decimal";
import { price } from "./costing";
import { IGV } from "./sales";

export { IGV };
export { movingAverage } from "./inventory";

/** Precio por modalidad "margen" con IGV (legacy: costing.price(cost, "margin", m, tax)). */
export const priceFromMargin = (cost: Num, margin: Num, tax: Num = IGV) => price(cost, "margin", margin, tax);

/** Importe en soles para mostrar: "S/ 12.50". */
export const soles = (value: Num) => `S/ ${money(value).toFixed(2)}`;
