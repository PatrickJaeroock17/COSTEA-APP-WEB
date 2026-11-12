import Decimal from "decimal.js";

/**
 * Decimal del motor: mismo contexto que el `decimal` de Python del original
 * (28 dígitos significativos, redondeo bancario en operaciones intermedias).
 * Es un clon: no altera la configuración global de decimal.js.
 */
export const D = Decimal.clone({ precision: 28, rounding: Decimal.ROUND_HALF_EVEN, toExpNeg: -30, toExpPos: 40 });
export type Dec = InstanceType<typeof D>;

/** Entrada numérica aceptada: Decimal o texto. Nunca `number` (CLAUDE.md: nada de `number` para dinero). */
export type Num = Decimal | string;

export const ZERO = new D(0);
export const ONE = new D(1);
export const CENT = new D("0.01");

/** Convierte a Decimal del motor rechazando `number`, NaN e infinitos (legacy: materials.nonnegative sin el signo). */
export function dec(value: unknown): Dec {
  if (value instanceof Decimal || (typeof value === "string" && value.trim() !== "")) {
    let d: Dec;
    try {
      d = new D(value as Decimal | string);
    } catch {
      throw new Error("Se requiere un decimal finito no negativo.");
    }
    if (!d.isFinite()) throw new Error("Se requiere un decimal finito no negativo.");
    return d;
  }
  throw new Error("Se requiere un decimal finito no negativo.");
}

/** legacy: materials.nonnegative */
export function nonnegative(value: unknown): Dec {
  const d = dec(value);
  if (d.isNegative() && !d.isZero()) throw new Error("Se requiere un decimal finito no negativo.");
  return d.isZero() ? d.abs() : d;
}

/** legacy: costing.money — a céntimos con redondeo comercial (ROUND_HALF_UP). */
export const money = (value: Num): Dec => new D(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export const sum = (values: Iterable<Dec>): Dec => {
  let total = ZERO;
  for (const v of values) total = total.plus(v);
  return total;
};

export const maxDec = (a: Dec, b: Dec): Dec => (b.gt(a) ? b : a);

/** Claves de líneas/productos: el original usa enteros o textos indistintamente. */
export type Key = string | number;

/** Orden de claves como Python: números entre sí numéricamente, textos entre sí alfabéticamente. */
export function compareKeys(a: Key, b: Key): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/** legacy: materials.decimal_text — sin ceros a la derecha. */
export function decimalText(value: Num | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const text = new D(value).toFixed();
  return text.includes(".") ? text.replace(/0+$/, "").replace(/\.$/, "") : text;
}

/** legacy: recipes.money_text — dos decimales, sin símbolo. */
export function moneyText(value: Num | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return money(value).toFixed(2);
}

/** legacy: planning.plain — serializa Decimal/Map para instantáneas JSON reproducibles. */
export function plain(value: unknown): unknown {
  if (value instanceof Decimal) return value.toFixed();
  if (value instanceof Map) return Object.fromEntries([...value].map(([k, v]) => [String(k), plain(v)]));
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  }
  return value;
}
