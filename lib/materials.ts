// Reglas de insumos sin dependencias de servidor (legacy: forms/material.py, routes/materials.py).
import { convertQuantity } from "@/lib/costing/units";
import { decimalText } from "@/lib/costing/decimal";

/** legacy: ExactNumberField — hasta 12 enteros y 6 decimales, sin separador de miles; coma o punto. */
export function parseAmount(raw: unknown, { positive = false } = {}): { value: string } | { error: string } {
  const text = String(raw ?? "").trim();
  if (!/^[0-9]{1,12}(?:[.,][0-9]{1,6})?$/.test(text)) {
    return { error: "Ingresa solo el número: hasta 12 enteros y 6 decimales, sin separador de miles." };
  }
  const value = text.replace(",", ".");
  if (positive && Number(value) === 0) return { error: "Debe ser mayor que cero." };
  return { value };
}

/** Fecha ISO válida (AAAA-MM-DD). */
export function parseDate(raw: unknown): string | null {
  const text = String(raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text ? text : null;
}

/** Hoy en Perú (AAAA-MM-DD). */
export function limaToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/**
 * Fecha de referencia de precios para el mes de trabajo (legacy: selected_date = fin del mes).
 * Si hoy cae dentro de ese mes, se usa hoy para registrar; los precios vigentes se leen al fin de mes.
 */
export function periodDates(period: { year: number; month: number } | null, today = limaToday()) {
  if (!period) return { reference: today, defaultEntry: today };
  const last = new Date(Date.UTC(period.year, period.month, 0)).getUTCDate();
  const start = `${period.year}-${String(period.month).padStart(2, "0")}-01`;
  const end = `${period.year}-${String(period.month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { reference: end, defaultEntry: today >= start && today <= end ? today : end };
}

export const MATERIAL_CODE = /^[A-Z]{3}-[0-9]{3}$/;

export interface MaterialValues {
  code: string;
  name: string;
  variety: string;
  category: string;
  supplier: string;
}

/** legacy: MaterialForm (edición). El código solo se valida si el insumo es propio. */
export function validateMaterial(input: Record<string, unknown>, { codeEditable }: { codeEditable: boolean }) {
  const v: MaterialValues = {
    code: String(input.code ?? "").trim().toUpperCase(),
    name: String(input.name ?? "").trim(),
    variety: String(input.variety ?? "").trim(),
    category: String(input.category ?? "").trim(),
    supplier: String(input.supplier ?? "").trim(),
  };
  const errors: Partial<Record<keyof MaterialValues, string>> = {};
  if (codeEditable && !MATERIAL_CODE.test(v.code)) errors.code = "Usa tres letras, un guion y tres números; por ejemplo ABA-001.";
  if (!v.name) errors.name = "Escribe el nombre del insumo.";
  else if (v.name.length > 220) errors.name = "Usa hasta 220 caracteres.";
  if (v.variety.length > 100) errors.variety = "Usa hasta 100 caracteres.";
  if (!v.category) errors.category = "Escribe o elige una categoría.";
  else if (v.category.length > 100) errors.category = "Usa hasta 100 caracteres.";
  if (v.supplier.length > 180) errors.supplier = "Usa hasta 180 caracteres.";
  return { values: v, errors };
}

export interface UnitRow {
  code: string;
  name: string;
  symbol: string;
  dimension: string;
  numerator: number;
  denominator: number;
}

/** legacy: conversion() — una presentación no puede redefinir una unidad universal ni repetirse. */
export function validateConversionLabel(label: string, units: UnitRow[], existing: string[]): string | null {
  const clean = label.trim();
  if (!clean) return "Escribe el nombre de la presentación.";
  if (clean.length > 80) return "Usa hasta 80 caracteres.";
  const folded = clean.toLocaleLowerCase("es");
  const universal = new Set(units.flatMap((u) => [u.code, u.name, u.symbol]).map((x) => x.toLocaleLowerCase("es")));
  if (universal.has(folded)) {
    return "Usa un nombre específico, por ejemplo «Bolsa 5 kg» o «Atado», no una unidad universal.";
  }
  if (existing.some((e) => e.toLocaleLowerCase("es") === folded)) {
    return "Ya existe esa presentación. Usa un nombre distinto.";
  }
  return null;
}

export interface PurchaseOption {
  key: string;
  label: string;
  /** Unidades base por una unidad de compra. */
  factor: string;
  evidence: string;
}

/**
 * Unidades de compra posibles (legacy: purchase_options): unidades habilitadas de la misma dimensión
 * que la base (equivalencia universal) y las presentaciones propias del insumo.
 */
export function purchaseOptions(
  base: UnitRow,
  enabled: UnitRow[],
  conversions: { id: number; label: string; factor: string; evidence: string }[],
): PurchaseOption[] {
  const seen = new Set<string>();
  const options: PurchaseOption[] = [];
  for (const unit of [base, ...enabled]) {
    if (unit.dimension !== base.dimension || seen.has(unit.code)) continue;
    seen.add(unit.code);
    options.push({
      key: `unit:${unit.code}`,
      label: unit.name,
      factor: decimalText(convertQuantity("1", unit, base)),
      evidence: "Equivalencia universal entre unidades de la misma dimensión.",
    });
  }
  for (const c of conversions) {
    options.push({ key: `custom:${c.id}`, label: c.label, factor: decimalText(c.factor), evidence: c.evidence });
  }
  return options;
}

/** Nombre visible: nombre + variedad. */
export const materialName = (m: { name: string; variety: string | null }) => (m.variety ? `${m.name} ${m.variety}` : m.name);
