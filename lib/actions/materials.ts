"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { canEdit, getAppContext } from "@/lib/auth";
import { acquisitionCost } from "@/lib/costing/materials";
import { getUnits } from "@/lib/data/materials";
import { parseAmount, parseDate, purchaseOptions, validateConversionLabel, validateMaterial } from "@/lib/materials";
import { createClient } from "@/lib/supabase/server";

export type MaterialState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
// PostgREST acepta numeric como texto: así el importe llega exacto (los tipos generados dicen number).
const exact = (value: string) => value as unknown as number;

function dbMessage(error: { code?: string; message?: string; details?: string } | null, fallback: string) {
  if (!error) return fallback;
  if (error.code === "P0001" && error.message) return error.message;
  if (error.code === "42501") return "No tienes permiso para hacer este cambio.";
  if (error.code === "23505") {
    const where = `${error.message ?? ""} ${error.details ?? ""}`;
    if (where.includes("name_variety")) return "Ya existe un insumo con ese nombre y variedad en este restaurante.";
    if (where.includes("code")) return "Ese código ya existe en el restaurante, incluso entre archivados.";
    if (where.includes("label")) return "Ya existe una presentación con ese nombre.";
  }
  return fallback;
}

/** Restaurante activo en el que el usuario puede editar. */
async function editable() {
  const ctx = await getAppContext();
  if (!ctx.restaurant || !canEdit(ctx.restaurant.role)) return { error: "No tienes permiso para editar insumos." } as const;
  return { ctx, restaurant: ctx.restaurant } as const;
}

/** Insumo del restaurante activo, editable por el usuario. */
async function editableMaterial(materialId: number) {
  const access = await editable();
  if ("error" in access) return { error: access.error } as const;
  const supabase = await createClient();
  const { data: material } = await supabase
    .from("materials")
    .select("id, code, active, base_unit_code, catalog_material_id")
    .eq("restaurant_id", access.restaurant.id)
    .eq("id", materialId)
    .maybeSingle();
  if (!material) return { error: "El insumo no existe en este restaurante." } as const;
  return { ...access, material } as const;
}

/* ───────────── Alta ───────────── */

export async function addCatalogMaterial(_prev: MaterialState, fd: FormData): Promise<MaterialState> {
  const access = await editable();
  if ("error" in access) return { error: access.error };
  const catalogId = Number(text(fd, "catalogId"));
  if (!Number.isInteger(catalogId) || catalogId <= 0) return { error: "Insumo del catálogo inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_catalog_material", { p_restaurant: access.restaurant.id, p_catalog_id: catalogId });
  if (error || !data) return { error: dbMessage(error, "No pudimos agregar el insumo.") };
  redirect(`/app/insumos/${data}?agregado=1`);
}

export async function createMaterial(_prev: MaterialState, fd: FormData): Promise<MaterialState> {
  const values = Object.fromEntries(["name", "variety", "category", "unit", "unitCost", "effectiveOn", "supplier"].map((k) => [k, text(fd, k)]));
  const access = await editable();
  if ("error" in access) return { error: access.error, values };
  const fieldErrors: Record<string, string> = {};
  if (!values.name) fieldErrors.name = "Escribe el nombre del insumo.";
  else if (values.name.length > 100) fieldErrors.name = "Usa hasta 100 caracteres.";
  if (values.variety.length > 100) fieldErrors.variety = "Usa hasta 100 caracteres.";
  if (!values.category) fieldErrors.category = "Elige una categoría.";
  if (!values.unit) fieldErrors.unit = "Elige la unidad base.";
  const cost = parseAmount(values.unitCost);
  if ("error" in cost) fieldErrors.unitCost = cost.error;
  const date = parseDate(values.effectiveOn);
  if (!date) fieldErrors.effectiveOn = "Elige una fecha válida.";
  if (Object.keys(fieldErrors).length) return { error: "Revisa los datos marcados.", fieldErrors, values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_material", {
    p_restaurant: access.restaurant.id,
    p_name: values.name,
    p_variety: values.variety || null,
    p_category: values.category,
    p_unit: values.unit,
    p_unit_cost: (cost as { value: string }).value,
    p_effective_on: date!,
    p_supplier: values.supplier || null,
  });
  if (error || !data) {
    const message = dbMessage(error, "No pudimos crear el insumo.");
    return { error: message, fieldErrors: message.startsWith("Ya existe") ? { name: message } : undefined, values };
  }
  redirect(`/app/insumos/${data}?creado=1`);
}

/* ───────────── Precios (versiones inmutables) ───────────── */

/** Precio directo por unidad base (legacy: update_price). */
export async function updatePrice(_prev: MaterialState, fd: FormData): Promise<MaterialState> {
  const values = { unitCost: text(fd, "unitCost"), effectiveOn: text(fd, "effectiveOn"), source: text(fd, "source") };
  const access = await editableMaterial(Number(text(fd, "materialId")));
  if ("error" in access) return { error: access.error, values };
  if (!access.material.active) return { error: "El insumo está archivado. Restáuralo para registrar precios.", values };
  const cost = parseAmount(values.unitCost);
  const date = parseDate(values.effectiveOn);
  const fieldErrors: Record<string, string> = {};
  if ("error" in cost) fieldErrors.unitCost = cost.error;
  if (!date) fieldErrors.effectiveOn = "Elige una fecha válida.";
  if (values.source.length > 500) fieldErrors.source = "Usa hasta 500 caracteres.";
  if (Object.keys(fieldErrors).length) return { error: "Revisa los datos marcados.", fieldErrors, values };

  const r = access.restaurant;
  const supabase = await createClient();
  const { error } = await supabase.from("material_cost_versions").insert({
    restaurant_id: r.id,
    material_id: access.material.id,
    effective_on: date!,
    mode: "direct",
    source: values.source || `Actualización manual · ${r.name}`,
    currency: r.currency,
    unit_cost: exact((cost as { value: string }).value),
  });
  if (error) return { error: dbMessage(error, "No pudimos guardar el precio."), values };
  refresh();
  return { message: "Precio actualizado. El historial anterior se conserva." };
}

/** Costo con comprobante: neto + impuesto no recuperable + otros costos; el IGV recuperable va aparte. */
export async function addPurchaseCost(_prev: MaterialState, fd: FormData): Promise<MaterialState> {
  const keys = ["quantity", "purchaseUnit", "netAmount", "nonrecoverableTax", "recoverableTax", "attributableCost", "effectiveOn", "source"];
  const values = Object.fromEntries(keys.map((k) => [k, text(fd, k)]));
  const access = await editableMaterial(Number(text(fd, "materialId")));
  if ("error" in access) return { error: access.error, values };
  if (!access.material.active) return { error: "El insumo está archivado. Restáuralo para registrar precios.", values };

  const fieldErrors: Record<string, string> = {};
  const amounts: Record<string, string> = {};
  for (const key of ["quantity", "netAmount", "nonrecoverableTax", "recoverableTax", "attributableCost"]) {
    const parsed = parseAmount(values[key], { positive: key === "quantity" });
    if ("error" in parsed) fieldErrors[key] = parsed.error;
    else amounts[key] = parsed.value;
  }
  const date = parseDate(values.effectiveOn);
  if (!date) fieldErrors.effectiveOn = "Elige una fecha válida.";
  if (!values.source) fieldErrors.source = "Indica el comprobante o sustento.";
  else if (values.source.length > 500) fieldErrors.source = "Usa hasta 500 caracteres.";

  const supabase = await createClient();
  const r = access.restaurant;
  const [{ data: conversions }, units] = await Promise.all([
    supabase.from("material_conversions").select("id, label, factor::text, evidence").eq("material_id", access.material.id),
    getUnits(supabase, r.id),
  ]);
  const base = units.byCode.get(access.material.base_unit_code)!;
  const option = purchaseOptions(base, units.enabled, (conversions ?? []) as never).find((o) => o.key === values.purchaseUnit);
  if (!option) fieldErrors.purchaseUnit = "Elige la unidad de compra.";
  if (Object.keys(fieldErrors).length) return { error: "Revisa los datos marcados.", fieldErrors, values };

  // Valida la aritmética antes de guardar (legacy: version_result antes de add).
  acquisitionCost(amounts.quantity, option!.factor, amounts.netAmount, amounts.nonrecoverableTax, amounts.attributableCost, amounts.recoverableTax);
  const { error } = await supabase.from("material_cost_versions").insert({
    restaurant_id: r.id,
    material_id: access.material.id,
    effective_on: date!,
    mode: "purchase",
    source: values.source,
    currency: r.currency,
    quantity: exact(amounts.quantity),
    purchase_unit: option!.label,
    factor: exact(option!.factor),
    conversion_evidence: option!.evidence,
    net_amount: exact(amounts.netAmount),
    nonrecoverable_tax: exact(amounts.nonrecoverableTax),
    recoverable_tax: exact(amounts.recoverableTax),
    attributable_cost: exact(amounts.attributableCost),
  });
  if (error) return { error: dbMessage(error, "No pudimos guardar el costo."), values };
  refresh();
  return { message: "Costo de compra guardado. El IGV recuperable queda fuera del costo." };
}

/* ───────────── Compras al kardex ───────────── */

export async function registerPurchase(_prev: MaterialState, fd: FormData): Promise<MaterialState> {
  const values = Object.fromEntries(["quantity", "purchaseUnit", "unitPrice", "movementOn"].map((k) => [k, text(fd, k)]));
  const access = await editableMaterial(Number(text(fd, "materialId")));
  if ("error" in access) return { error: access.error, values };
  const quantity = parseAmount(values.quantity, { positive: true });
  const price = parseAmount(values.unitPrice);
  const date = parseDate(values.movementOn);
  const fieldErrors: Record<string, string> = {};
  if ("error" in quantity) fieldErrors.quantity = quantity.error;
  if ("error" in price) fieldErrors.unitPrice = price.error;
  if (!date) fieldErrors.movementOn = "Elige una fecha válida.";
  if (!values.purchaseUnit) fieldErrors.purchaseUnit = "Elige la unidad de compra.";
  if (Object.keys(fieldErrors).length) return { error: "Revisa los datos marcados.", fieldErrors, values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("register_purchase", {
    p_material: access.material.id,
    p_quantity: (quantity as { value: string }).value,
    p_unit: values.purchaseUnit,
    p_unit_price: (price as { value: string }).value,
    p_date: date!,
    p_token: text(fd, "token"),
  });
  if (error) return { error: dbMessage(error, "No pudimos registrar la compra."), values };
  refresh();
  return { message: "Compra registrada en el kardex y en el historial de precios." };
}

/* ───────────── Presentaciones ───────────── */

export async function addConversion(_prev: MaterialState, fd: FormData): Promise<MaterialState> {
  const values = { label: text(fd, "label"), factor: text(fd, "factor"), evidence: text(fd, "evidence") };
  const access = await editableMaterial(Number(text(fd, "materialId")));
  if ("error" in access) return { error: access.error, values };
  if (!access.material.active) return { error: "El insumo está archivado.", values };
  const supabase = await createClient();
  const [{ data: existing }, units] = await Promise.all([
    supabase.from("material_conversions").select("label").eq("material_id", access.material.id),
    getUnits(supabase, access.restaurant.id),
  ]);
  const fieldErrors: Record<string, string> = {};
  const labelError = validateConversionLabel(values.label, units.all, (existing ?? []).map((e) => e.label));
  if (labelError) fieldErrors.label = labelError;
  const factor = parseAmount(values.factor, { positive: true });
  if ("error" in factor) fieldErrors.factor = factor.error;
  if (!values.evidence) fieldErrors.evidence = "Indica cómo se obtuvo la equivalencia.";
  else if (values.evidence.length > 500) fieldErrors.evidence = "Usa hasta 500 caracteres.";
  if (Object.keys(fieldErrors).length) return { error: "Revisa los datos marcados.", fieldErrors, values };

  const { error } = await supabase.from("material_conversions").insert({
    restaurant_id: access.restaurant.id,
    material_id: access.material.id,
    label: values.label,
    factor: exact((factor as { value: string }).value),
    evidence: values.evidence,
  });
  if (error) return { error: dbMessage(error, "No pudimos guardar la presentación."), values };
  refresh();
  return { message: "Presentación registrada solo para este insumo." };
}

/* ───────────── Datos y estado ───────────── */

export async function updateMaterial(_prev: MaterialState, fd: FormData): Promise<MaterialState> {
  const raw = Object.fromEntries(["code", "name", "variety", "category", "supplier"].map((k) => [k, text(fd, k)]));
  const access = await editableMaterial(Number(text(fd, "materialId")));
  if ("error" in access) return { error: access.error, values: raw };
  if (!access.material.active) return { error: "El insumo está archivado. Restáuralo para editarlo.", values: raw };
  const fromCatalog = access.material.catalog_material_id !== null;
  const { values, errors } = validateMaterial(raw, { codeEditable: !fromCatalog });
  if (Object.keys(errors).length) return { error: "Revisa los datos marcados.", fieldErrors: errors, values: raw };

  const supabase = await createClient();
  const { error } = await supabase
    .from("materials")
    .update({
      ...(fromCatalog ? {} : { code: values.code }),
      name: values.name,
      variety: values.variety || null,
      category: values.category,
      supplier: values.supplier || null,
    })
    .eq("id", access.material.id);
  if (error) {
    const message = dbMessage(error, "No pudimos guardar los datos.");
    return { error: message, fieldErrors: message.includes("código") ? { code: message } : message.startsWith("Ya existe") ? { name: message } : undefined, values: raw };
  }
  refresh();
  return { message: "Datos guardados." };
}

/** Archivar o restaurar; el historial se conserva. */
export async function setMaterialActive(fd: FormData) {
  const access = await editableMaterial(Number(text(fd, "materialId")));
  if ("error" in access) return;
  const supabase = await createClient();
  await supabase.from("materials").update({ active: text(fd, "state") === "active" }).eq("id", access.material.id);
  refresh();
}
