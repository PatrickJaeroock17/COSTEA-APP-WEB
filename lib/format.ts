// Formatos de presentación (es-PE). Solo muestran: nunca se usan para calcular.
import Decimal from "decimal.js";

const SYMBOLS: Record<string, string> = { PEN: "S/", USD: "US$", EUR: "€" };

const group = (integer: string) => integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** S/ 1,234.50 — redondeo comercial a `places` decimales. */
export function formatMoney(value: Decimal.Value | null | undefined, currency = "PEN", places = 2): string {
  if (value === null || value === undefined) return "—";
  const d = new Decimal(value).toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
  const [int, frac] = d.abs().toFixed(places).split(".");
  return `${d.isNegative() && !d.isZero() ? "−" : ""}${SYMBOLS[currency] ?? currency} ${group(int)}${frac ? `.${frac}` : ""}`;
}

/** Precio unitario: hasta 4 decimales si hacen falta (p. ej. S/ 0.0125 por gramo). */
export function formatUnitPrice(value: Decimal.Value | null | undefined, currency = "PEN"): string {
  if (value === null || value === undefined) return "—";
  const d = new Decimal(value);
  return formatMoney(d, currency, d.abs().lt(1) && !d.toDecimalPlaces(2).eq(d) ? 4 : 2);
}

/** Cantidad sin ceros sobrantes, hasta `places` decimales: 6.5, 0.25, 1,250. */
export function formatQty(value: Decimal.Value | null | undefined, places = 3): string {
  if (value === null || value === undefined) return "—";
  const d = new Decimal(value).toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
  const [int, frac] = d.abs().toFixed().split(".");
  return `${d.isNegative() && !d.isZero() ? "−" : ""}${group(int)}${frac ? `.${frac}` : ""}`;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

/** 2026-11-12 → 12 nov 2026 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
