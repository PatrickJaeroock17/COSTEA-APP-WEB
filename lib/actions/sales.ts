"use server";

import { refresh } from "next/cache";
import { canEdit, getAppContext } from "@/lib/auth";
import { getProductDetail } from "@/lib/data/products";
import { parseAmount, parseDate } from "@/lib/materials";
import { createClient } from "@/lib/supabase/server";

export type SaleState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

/**
 * Registra una venta (legacy: sales.index POST). El costo unitario de materiales se calcula a la fecha de
 * venta con la misma regla de la ficha del plato (promedio del kardex o precio de la receta); la base
 * congela precio y costo y descuenta el kardex exigiendo stock.
 */
export async function registerSale(_prev: SaleState, fd: FormData): Promise<SaleState> {
  const values = { productId: text(fd, "productId"), soldOn: text(fd, "soldOn"), quantity: text(fd, "quantity") };
  const ctx = await getAppContext();
  const r = ctx.restaurant;
  const period = ctx.period;
  if (!r || !canEdit(r.role)) return { error: "No tienes permiso para registrar ventas.", values };
  if (!period) return { error: "Agrega un mes de trabajo en Configuración.", values };

  const fieldErrors: Record<string, string> = {};
  const productId = Number(values.productId);
  if (!Number.isInteger(productId) || productId <= 0) fieldErrors.productId = "Elige el plato vendido.";
  const soldOn = parseDate(values.soldOn);
  const mm = `${period.year}-${String(period.month).padStart(2, "0")}`;
  if (!soldOn) fieldErrors.soldOn = "Elige la fecha de venta.";
  else if (!soldOn.startsWith(mm)) fieldErrors.soldOn = `Registra una fecha dentro de ${period.label}, el mes de trabajo.`;
  const quantity = parseAmount(values.quantity, { positive: true });
  if ("error" in quantity) fieldErrors.quantity = quantity.error;
  if (Object.keys(fieldErrors).length) {
    const names = { productId: "Plato", soldOn: "Fecha", quantity: "Cantidad" } as Record<string, string>;
    return { error: `Revisa: ${Object.keys(fieldErrors).map((k) => names[k]).join(", ")}.`, fieldErrors, values };
  }

  const detail = await getProductDetail(r.id, productId, null, soldOn!);
  if (!detail) return { error: "El plato no existe en este restaurante.", fieldErrors: { productId: "Elige el plato vendido." }, values };
  if (!detail.cost.perUnit) {
    return { error: "Completa los insumos de la receta antes de registrar ventas.", fieldErrors: { productId: "La receta no tiene insumos." }, values };
  }
  const stale = detail.cost.lines.some(
    (l) => l.priceSource !== "kardex" && (!l.version || l.version.effective_on > soldOn! || (l.version as { currency?: string }).currency !== r.currency),
  );
  if (stale) {
    const message = "Revisa la moneda y las fechas de vigencia de los costos de la receta: hay precios posteriores a la fecha de venta.";
    return { error: message, fieldErrors: { productId: message }, values };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("register_sale", {
    p_period: period.id,
    p_product: productId,
    p_sold_on: soldOn!,
    p_quantity: (quantity as { value: string }).value,
    p_unit_cost: detail.cost.perUnit.toFixed(),
  });
  if (error) {
    const message = error.code === "P0001" && error.message ? error.message : error.code === "42501" ? "No tienes permiso para registrar ventas." : "No pudimos registrar la venta.";
    return { error: message, fieldErrors: { quantity: message }, values };
  }
  refresh();
  return { message: "Venta guardada y salida de inventario registrada.", values: { productId: values.productId, soldOn: values.soldOn, quantity: "" } };
}

/** Elimina la venta y anula sus salidas del kardex (legacy: delete + void_sale_outputs). */
export async function deleteSale(fd: FormData) {
  const ctx = await getAppContext();
  const id = Number(fd.get("saleId"));
  if (!ctx.restaurant || !canEdit(ctx.restaurant.role) || !Number.isInteger(id)) return;
  const supabase = await createClient();
  await supabase.rpc("delete_sale", { p_sale: id });
  refresh();
}
