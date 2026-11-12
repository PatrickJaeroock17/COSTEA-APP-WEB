// Reglas de datos del restaurante y de los periodos (legacy: forms/company.py, models/period.py).
// Sin dependencias de servidor: lo usan las acciones, los formularios y las pruebas.

export const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre",
] as const;

export const periodLabel = (year: number, month: number) => `${MONTH_NAMES[month - 1]} ${year}`;
export const periodKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

export const CURRENCIES = [
  { value: "PEN", label: "PEN · Sol peruano" },
  { value: "USD", label: "USD · Dólar estadounidense" },
  { value: "EUR", label: "EUR · Euro" },
] as const;
export type Currency = (typeof CURRENCIES)[number]["value"];

export const TAX_ID_KINDS = [
  { value: "peru_ruc", label: "RUC · 11 dígitos" },
  { value: "other", label: "Otro identificador" },
] as const;
export type TaxIdKind = (typeof TAX_ID_KINDS)[number]["value"];

/** En restaurantes el IGV es fijo: 18 % (legacy: apply_company_form y periods()). */
export const RESTAURANT_TAX_RATE = "0.18";

export const UNIT_DIMENSIONS: Record<string, string> = {
  mass: "Peso",
  volume: "Volumen",
  count: "Cantidad",
  length: "Longitud",
  area: "Área",
  time: "Tiempo",
};

/** "AAAA-MM" → año y mes (legacy: MonthField). */
export function parseMonthKey(value: string): { year: number; month: number } | { error: string } {
  if (!/^[0-9]{4}-[0-9]{2}$/.test(value)) return { error: "Selecciona un mes válido (AAAA-MM)." };
  const [year, month] = value.split("-").map(Number);
  if (!(year >= 1900 && year <= 9999 && month >= 1 && month <= 12)) {
    return { error: "El año debe ser de 1900 a 9999 y el mes de 1 a 12." };
  }
  return { year, month };
}

export interface RestaurantValues {
  legalName: string;
  tradeName: string;
  taxIdKind: TaxIdKind;
  taxId: string;
  currency: Currency;
}

export type RestaurantErrors = Partial<Record<keyof RestaurantValues | "month", string>>;

const clean = (v: unknown) => String(v ?? "").trim();

/** Valida los datos del restaurante (legacy: CompanyForm). */
export function validateRestaurant(input: Record<string, unknown>): {
  values: RestaurantValues;
  errors: RestaurantErrors;
} {
  const values: RestaurantValues = {
    legalName: clean(input.legalName),
    tradeName: clean(input.tradeName),
    taxIdKind: (clean(input.taxIdKind) || "peru_ruc") as TaxIdKind,
    taxId: clean(input.taxId),
    currency: (clean(input.currency) || "PEN") as Currency,
  };
  const errors: RestaurantErrors = {};
  if (!values.legalName) errors.legalName = "Ingresa la razón social.";
  else if (values.legalName.length < 2 || values.legalName.length > 180) errors.legalName = "Usa entre 2 y 180 caracteres.";
  if (values.tradeName.length > 180) errors.tradeName = "Usa hasta 180 caracteres.";
  if (!TAX_ID_KINDS.some((k) => k.value === values.taxIdKind)) errors.taxIdKind = "Elige un tipo de identificación.";
  if (values.taxId) {
    if (values.taxId.length > 20) errors.taxId = "Usa hasta 20 caracteres.";
    else if (values.taxIdKind === "peru_ruc" && !/^[0-9]{11}$/.test(values.taxId)) {
      errors.taxId = "El RUC debe contener exactamente 11 dígitos.";
    } else if (values.taxIdKind === "other" && !/^[A-Za-z0-9 ._/-]{1,20}$/.test(values.taxId)) {
      errors.taxId = "Usa letras, números, espacios, puntos, barras o guiones.";
    }
  }
  if (!CURRENCIES.some((c) => c.value === values.currency)) errors.currency = "Elige una moneda.";
  return { values, errors };
}

/** Nombre visible: comercial si existe; si no, la razón social. */
export const displayName = (r: { legal_name: string; trade_name: string | null }) => r.trade_name || r.legal_name;
