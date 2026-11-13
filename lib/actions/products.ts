"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { canEdit, getAppContext } from "@/lib/auth";
import { money } from "@/lib/costing/decimal";
import { parseAmount } from "@/lib/materials";
import { type LineSpec, parseLine } from "@/lib/recipes";
import { createClient } from "@/lib/supabase/server";

export type ProductState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const int = (fd: FormData, key: string) => {
  const n = Number(text(fd, key));
  return Number.isInteger(n) && n > 0 ? n : null;
};

function dbMessage(error: { code?: string; message?: string } | null, fallback: string) {
  if (!error) return fallback;
  if (error.code === "P0001" && error.message) return error.message;
  if (error.code === "42501") return "No tienes permiso para hacer este cambio.";
  return fallback;
}

async function editableRestaurant() {
  const ctx = await getAppContext();
  if (!ctx.restaurant || !canEdit(ctx.restaurant.role)) return null;
  return ctx.restaurant;
}

/** Líneas de la versión vigente como especificación para la versión siguiente. */
async function currentLines(productId: number): Promise<LineSpec[]> {
  const supabase = await createClient();
  const { data: version } = await supabase
    .from("recipe_versions")
    .select("id")
    .eq("product_id", productId)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!version) return [];
  const { data } = await supabase
    .from("recipe_lines")
    .select("material_id, cost_version_id, quantity::text, unit_key, mode, rate::text")
    .eq("recipe_id", version.id)
    .order("position");
  return (data ?? []) as unknown as LineSpec[];
}

/* ───────────── Alta ───────────── */

export async function createProduct(_prev: ProductState, fd: FormData): Promise<ProductState> {
  const values = { name: text(fd, "name"), description: text(fd, "description"), menuCategory: text(fd, "menuCategory"), output: text(fd, "output") || "1" };
  const r = await editableRestaurant();
  if (!r) return { error: "No tienes permiso para crear platos.", values };
  const fieldErrors: Record<string, string> = {};
  if (!values.name) fieldErrors.name = "Escribe el nombre del plato.";
  else if (values.name.length > 180) fieldErrors.name = "Usa hasta 180 caracteres.";
  if (values.description.length > 500) fieldErrors.description = "Usa hasta 500 caracteres.";
  if (values.menuCategory.length > 50) fieldErrors.menuCategory = "Usa hasta 50 caracteres.";
  const output = parseAmount(values.output, { positive: true });
  if ("error" in output) fieldErrors.output = output.error;
  if (Object.keys(fieldErrors).length) return { error: "Revisa los datos marcados.", fieldErrors, values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_product", {
    p_restaurant: r.id,
    p_name: values.name,
    p_description: values.description || null,
    p_menu_category: values.menuCategory || null,
    p_output_quantity: (output as { value: string }).value,
  });
  if (error || !data) {
    const message = dbMessage(error, "No pudimos crear el plato.");
    return { error: message, fieldErrors: message.startsWith("Ya existe") ? { name: message } : undefined, values };
  }
  redirect(`/app/platos/${data}?creado=1`);
}

export async function personalizeDish(_prev: ProductState, fd: FormData): Promise<ProductState> {
  const r = await editableRestaurant();
  if (!r) return { error: "No tienes permiso para crear platos." };
  const dish = int(fd, "dishId");
  if (!dish) return { error: "Plato del catálogo inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("personalize_dish", { p_restaurant: r.id, p_dish: dish });
  if (error || !data) return { error: dbMessage(error, "No pudimos traer el plato del catálogo."), values: { dishId: String(dish) } };
  redirect(`/app/platos/${data}?catalogo=1`);
}

/* ───────────── Receta (cada cambio crea una versión) ───────────── */

/** Agrega un insumo o reemplaza su fila (cantidad, unidad, merma o precio). */
export async function saveIngredient(_prev: ProductState, fd: FormData): Promise<ProductState> {
  const values = Object.fromEntries(["materialId", "costVersionId", "quantity", "unitKey", "mode", "percent"].map((k) => [k, text(fd, k)]));
  const r = await editableRestaurant();
  const productId = int(fd, "productId");
  const revision = int(fd, "revision");
  if (!r || !productId || !revision) return { error: "No tienes permiso para editar esta receta.", values };
  const materialId = int(fd, "materialId");
  const costVersionId = int(fd, "costVersionId");
  const parsed = parseLine(values);
  const fieldErrors: Record<string, string> = "errors" in parsed ? { ...parsed.errors } : {};
  if (!materialId) fieldErrors.materialId = "Elige un insumo.";
  if (!costVersionId) fieldErrors.costVersionId = "Elige el precio que usará la receta. Si no tiene, regístralo en Insumos.";
  if (Object.keys(fieldErrors).length) return { error: "Revisa los datos marcados.", fieldErrors, values };

  const spec: LineSpec = { material_id: materialId!, cost_version_id: costVersionId!, ...(parsed as { value: Omit<LineSpec, "material_id" | "cost_version_id"> }).value };
  const lines = await currentLines(productId);
  const editing = text(fd, "editing") === "1";
  if (!editing && lines.some((l) => l.material_id === materialId)) {
    return { error: "Este insumo ya está en la receta. Edita su fila para cambiar la cantidad o el precio.", values };
  }
  const next = editing ? lines.map((l) => (l.material_id === materialId ? spec : l)) : [...lines, spec];
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_recipe", { p_product: productId, p_revision: revision, p_lines: next as never });
  if (error) return { error: dbMessage(error, "No pudimos guardar la receta."), values };
  refresh();
  return { message: editing ? "Insumo actualizado. La versión anterior conserva sus cantidades y precios." : "Insumo agregado a la receta." };
}

export async function removeIngredient(fd: FormData) {
  const r = await editableRestaurant();
  const productId = int(fd, "productId");
  const revision = int(fd, "revision");
  const materialId = int(fd, "materialId");
  if (!r || !productId || !revision || !materialId) return;
  const lines = await currentLines(productId);
  const supabase = await createClient();
  await supabase.rpc("save_recipe", { p_product: productId, p_revision: revision, p_lines: lines.filter((l) => l.material_id !== materialId) as never });
  refresh();
}

export async function scaleRecipe(_prev: ProductState, fd: FormData): Promise<ProductState> {
  const values = { output: text(fd, "output") };
  const r = await editableRestaurant();
  const productId = int(fd, "productId");
  const revision = int(fd, "revision");
  if (!r || !productId || !revision) return { error: "No tienes permiso para editar esta receta.", values };
  const output = parseAmount(values.output, { positive: true });
  if ("error" in output) return { error: output.error, fieldErrors: { output: output.error }, values };
  const supabase = await createClient();
  const { error } = await supabase.rpc("scale_recipe", { p_product: productId, p_revision: revision, p_output_quantity: output.value });
  if (error) return { error: dbMessage(error, "No pudimos escalar la receta."), values };
  refresh();
  return { message: "Receta escalada proporcionalmente. La versión anterior se conserva." };
}

export async function updateProduct(_prev: ProductState, fd: FormData): Promise<ProductState> {
  const values = { name: text(fd, "name"), description: text(fd, "description"), menuCategory: text(fd, "menuCategory"), output: text(fd, "output") };
  const r = await editableRestaurant();
  const productId = int(fd, "productId");
  const revision = int(fd, "revision");
  if (!r || !productId || !revision) return { error: "No tienes permiso para editar este plato.", values };
  const fieldErrors: Record<string, string> = {};
  if (!values.name) fieldErrors.name = "Escribe el nombre del plato.";
  else if (values.name.length > 180) fieldErrors.name = "Usa hasta 180 caracteres.";
  if (values.description.length > 500) fieldErrors.description = "Usa hasta 500 caracteres.";
  if (values.menuCategory.length > 50) fieldErrors.menuCategory = "Usa hasta 50 caracteres.";
  const output = parseAmount(values.output, { positive: true });
  if ("error" in output) fieldErrors.output = output.error;
  if (Object.keys(fieldErrors).length) return { error: "Revisa los datos marcados.", fieldErrors, values };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_product", {
    p_product: productId,
    p_revision: revision,
    p_name: values.name,
    p_description: values.description || null,
    p_menu_category: values.menuCategory || null,
    p_output_quantity: (output as { value: string }).value,
  });
  if (error) {
    const message = dbMessage(error, "No pudimos guardar el plato.");
    return { error: message, fieldErrors: message.startsWith("Ya existe") ? { name: message } : undefined, values };
  }
  refresh();
  return { message: "Datos guardados en una nueva versión de la receta." };
}

/* ───────────── Precio de carta ───────────── */

/** Precio de venta por unidad, con IGV incluido (legacy: PriceForm). */
export async function saveSalePrice(_prev: ProductState, fd: FormData): Promise<ProductState> {
  const values = { amount: text(fd, "amount") };
  const r = await editableRestaurant();
  const productId = int(fd, "productId");
  if (!r || !productId) return { error: "No tienes permiso para cambiar precios.", values };
  const parsed = parseAmount(values.amount, { positive: true });
  if ("error" in parsed) return { error: parsed.error, fieldErrors: { amount: parsed.error }, values };
  const amount = money(parsed.value);
  if (amount.lte(0)) return { error: "El precio mínimo es 0.01.", fieldErrors: { amount: "El precio mínimo es 0.01." }, values };
  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("id").eq("restaurant_id", r.id).eq("id", productId).maybeSingle();
  if (!product) return { error: "El plato no existe en este restaurante.", values };
  const { error } = await supabase
    .from("product_prices")
    .upsert({ product_id: productId, restaurant_id: r.id, amount: amount.toFixed(2) as unknown as number }, { onConflict: "product_id" });
  if (error) return { error: dbMessage(error, "No pudimos guardar el precio."), values };
  refresh();
  return { message: "Precio guardado. Se aplicará a las nuevas ventas." };
}

/* ───────────── Estado ───────────── */

export async function setProductActive(fd: FormData) {
  const r = await editableRestaurant();
  const productId = int(fd, "productId");
  if (!r || !productId) return;
  const supabase = await createClient();
  await supabase.from("products").update({ active: text(fd, "state") === "active" }).eq("restaurant_id", r.id).eq("id", productId);
  refresh();
}

export async function deleteProduct(_prev: ProductState, fd: FormData): Promise<ProductState> {
  const r = await editableRestaurant();
  const productId = int(fd, "productId");
  const revision = int(fd, "revision");
  if (!r || !productId || !revision) return { error: "No tienes permiso para eliminar este plato." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_product", { p_product: productId, p_revision: revision });
  if (error) return { error: dbMessage(error, "No pudimos eliminar el plato.") };
  redirect("/app/platos?eliminado=1");
}
