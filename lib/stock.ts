// Faltantes de stock para mostrar (los envía la base en el DETAIL del error con HINT 'stock').
import { D } from "@/lib/costing/decimal";

export type ShortageRow = { name: string; unit: string; needed: string; available: string; missing: string };

/** Lee los faltantes del error de la base; null si el error no es de stock. Ordena por faltante, de mayor a menor. */
export function parseShortages(error: { hint?: string | null; details?: string | null } | null | undefined): ShortageRow[] | null {
  if (!error || error.hint !== "stock" || !error.details) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(error.details);
  } catch {
    return null;
  }
  if (!Array.isArray(raw)) return null;
  return raw
    .map((r: { name?: string; unit?: string; needed?: string; available?: string }) => {
      const needed = new D(r.needed ?? "0");
      const available = new D(r.available ?? "0");
      return { name: String(r.name ?? ""), unit: String(r.unit ?? ""), needed: needed.toFixed(), available: available.toFixed(), missing: needed.minus(available).toFixed() };
    })
    .sort((a, b) => new D(b.missing).cmp(a.missing) || a.name.localeCompare(b.name, "es"));
}

/** Cantidad con máximo 2 decimales y su unidad (redondeo hacia arriba para lo que falta, para no quedar corto). */
export function stockQty(value: string, unit: string, { ceil = false } = {}): string {
  const d = new D(value).toDecimalPlaces(2, ceil ? D.ROUND_UP : D.ROUND_HALF_UP);
  const [int, frac] = d.toFixed().split(".");
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${frac ? `.${frac}` : ""} ${unit}`;
}
