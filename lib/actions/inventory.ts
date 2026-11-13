"use server";

import { refresh } from "next/cache";
import { canEdit, getAppContext } from "@/lib/auth";
import { parseAmount, parseDate } from "@/lib/materials";
import { createClient } from "@/lib/supabase/server";

export type InventoryState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const LABELS: Record<string, string> = { materialId: "Insumo", movementOn: "Fecha", quantity: "Cantidad", unitCost: "Costo unitario", reference: "Comprobante o referencia" };

const dbMessage = (error: { code?: string; message?: string } | null, fallback: string) =>
  error?.code === "P0001" && error.message ? error.message : error?.code === "42501" ? "No tienes permiso para hacer este cambio." : fallback;

/** Entrada manual al kardex en la unidad base (legacy: inventory.index ReceiptForm). */
export async function registerReceipt(_prev: InventoryState, fd: FormData): Promise<InventoryState> {
  const values = Object.fromEntries(["materialId", "movementOn", "quantity", "unitCost", "reference"].map((k) => [k, text(fd, k)]));
  const ctx = await getAppContext();
  if (!ctx.restaurant || !canEdit(ctx.restaurant.role)) return { error: "No tienes permiso para registrar entradas.", values };
  const fieldErrors: Record<string, string> = {};
  const materialId = Number(values.materialId);
  if (!Number.isInteger(materialId) || materialId <= 0) fieldErrors.materialId = "Elige el insumo.";
  const date = parseDate(values.movementOn);
  if (!date) fieldErrors.movementOn = "Elige la fecha de la entrada.";
  const quantity = parseAmount(values.quantity, { positive: true });
  if ("error" in quantity) fieldErrors.quantity = quantity.error;
  const cost = parseAmount(values.unitCost);
  if ("error" in cost) fieldErrors.unitCost = cost.error;
  if (!values.reference) fieldErrors.reference = "Indica el comprobante o una referencia única.";
  else if (values.reference.length > 140) fieldErrors.reference = "Usa hasta 140 caracteres.";
  if (Object.keys(fieldErrors).length) return { error: `Revisa: ${Object.keys(fieldErrors).map((k) => LABELS[k]).join(", ")}.`, fieldErrors, values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("register_receipt", {
    p_material: materialId,
    p_date: date!,
    p_quantity: (quantity as { value: string }).value,
    p_unit_cost: (cost as { value: string }).value,
    p_reference: values.reference,
  });
  if (error) {
    const message = dbMessage(error, "No pudimos registrar la entrada.");
    return { error: message, fieldErrors: message.includes("ya está registrada") ? { reference: message } : undefined, values };
  }
  refresh();
  return { message: "Entrada de inventario registrada.", values: { materialId: values.materialId, movementOn: values.movementOn } };
}

/** Incorpora al kardex una compra con comprobante ya guardada (legacy: import_entry). */
export async function importSavedPurchase(fd: FormData): Promise<InventoryState> {
  const ctx = await getAppContext();
  const id = Number(fd.get("costVersionId"));
  if (!ctx.restaurant || !canEdit(ctx.restaurant.role) || !Number.isInteger(id)) return { error: "No tienes permiso para registrar entradas." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("import_saved_purchase", { p_cost_version: id });
  if (error) return { error: dbMessage(error, "No pudimos incorporar la compra.") };
  refresh();
  return { message: "Compra incorporada al kardex." };
}

/** Agrega el stock de apertura del catálogo que falte (legacy: opening_stock). */
export async function seedOpening(): Promise<InventoryState> {
  const ctx = await getAppContext();
  if (!ctx.restaurant || !canEdit(ctx.restaurant.role)) return { error: "No tienes permiso para registrar el stock de apertura." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("seed_catalog_opening", { p_restaurant: ctx.restaurant.id });
  if (error) return { error: dbMessage(error, "No pudimos registrar el stock de apertura.") };
  refresh();
  return { message: data ? `Se registraron ${data} entradas iniciales nuevas.` : "No faltaba ninguna entrada inicial del catálogo." };
}
