"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { canEdit, getAppContext } from "@/lib/auth";
import { parseDate } from "@/lib/materials";
import { parsePlanLine } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import { D } from "@/lib/costing/decimal";
import { evaluatePlan, getPlan } from "@/lib/data/plan";

export type PlanState = {
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

/** Crea un plan con los platos elegidos (legacy: plan_edit + selected_plan_lines). */
export async function createPlan(_prev: PlanState, fd: FormData): Promise<PlanState> {
  const values: Record<string, string> = Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
  const ctx = await getAppContext();
  const r = ctx.restaurant;
  if (!r || !canEdit(r.role)) return { error: "No tienes permiso para crear planes.", values };
  const periodId = int(fd, "periodId");
  if (!periodId || !ctx.periods.some((p) => p.id === periodId)) return { error: "Elige un mes de trabajo del restaurante.", values };
  const fieldErrors: Record<string, string> = {};
  const name = text(fd, "name");
  if (!name) fieldErrors.name = "Escribe el nombre del plan.";
  const priceDate = parseDate(text(fd, "priceDate"));
  if (!priceDate) fieldErrors.priceDate = "Elige la fecha de referencia de los precios.";
  if (fd.get("assumption") !== "on") fieldErrors.assumption = "Confirma este supuesto para usar el plan.";
  const ids = fd.getAll("dishIds").map(String);
  if (Object.keys(fieldErrors).length) return { error: "Revisa los datos marcados.", fieldErrors, values };

  const lines = ids.map((id) => ({
    product_id: Number(id),
    quantity: text(fd, `quantity_${id}`).replace(",", "."),
    price: text(fd, `price_${id}`).replace(",", "."),
    factor: text(fd, `factor_${id}`).replace(",", ".") || "1",
  }));
  const bad = lines.find((l) => [l.quantity, l.price, l.factor].some((x) => x && !/^[0-9]{1,12}(\.[0-9]{1,6})?$/.test(x)));
  if (bad) return { error: "Usa números con hasta 12 enteros y 6 decimales, sin separador de miles.", values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_plan", {
    p_restaurant: r.id,
    p_period: periodId,
    p_name: name,
    p_price_date: priceDate!,
    p_no_cif: fd.get("noCif") === "on",
    p_no_expenses: fd.get("noExpenses") === "on",
    p_lines: lines as never,
  });
  if (error || !data) return { error: dbMessage(error, "No pudimos crear el plan."), values };
  redirect(text(fd, "next") === "plan" ? `/app/plan/${data}` : "/app/costos?creado=1");
}

/** Edita la línea de un plato (legacy: plan_line). */
export async function savePlanLine(_prev: PlanState, fd: FormData): Promise<PlanState> {
  const values = Object.fromEntries(["quantity", "referencePrice", "equivalentFactor", "pricingMode", "pricingValue", "adoptedPrice"].map((k) => [k, text(fd, k)]));
  const ctx = await getAppContext();
  const r = ctx.restaurant;
  const planId = int(fd, "planId");
  const productId = int(fd, "productId");
  if (!r || !canEdit(r.role) || !planId || !productId) return { error: "No tienes permiso para editar este plan.", values };
  const parsed = parsePlanLine(values);
  if ("errors" in parsed) return { error: "Revisa los datos marcados.", fieldErrors: parsed.errors, values };
  const v = parsed.value;
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_plan_line", {
    p_plan: planId,
    p_product: productId,
    p_quantity: v.quantity,
    p_reference_price: v.referencePrice,
    p_equivalent_factor: v.equivalentFactor,
    p_pricing_mode: v.pricingMode,
    p_pricing_value: v.pricingValue,
    p_adopted_price: v.adoptedPrice,
    p_use_latest: fd.get("useLatest") === "on",
  });
  if (error) return { error: dbMessage(error, "No pudimos guardar el plato del plan."), values };
  refresh();
  return { message: "Guardado. El costo y el precio se recalcularon.", values };
}

export async function removePlanLine(fd: FormData) {
  const ctx = await getAppContext();
  const line = int(fd, "lineId");
  if (!ctx.restaurant || !canEdit(ctx.restaurant.role) || !line) return;
  const supabase = await createClient();
  await supabase.rpc("remove_plan_line", { p_line: line });
  const back = text(fd, "back");
  if (back.startsWith("/app/")) redirect(back);
  refresh();
}

export async function activatePlan(fd: FormData) {
  const ctx = await getAppContext();
  const plan = int(fd, "planId");
  if (!ctx.restaurant || !canEdit(ctx.restaurant.role) || !plan) return;
  const supabase = await createClient();
  await supabase.rpc("activate_plan", { p_plan: plan });
  refresh();
}

/* ───────────── Fase 11: escenarios y revisión del cálculo ───────────── */

/** Datos del plan (legacy: plan_edit). El mes no cambia; cualquier cambio invalida el cálculo revisado. */
export async function updatePlan(_prev: PlanState, fd: FormData): Promise<PlanState> {
  const values = { name: text(fd, "name"), priceDate: text(fd, "priceDate"), noCif: text(fd, "noCif"), noExpenses: text(fd, "noExpenses") };
  const ctx = await getAppContext();
  const r = ctx.restaurant;
  const planId = int(fd, "planId");
  if (!r || !canEdit(r.role) || !planId) return { error: "No tienes permiso para editar este plan.", values };
  const fieldErrors: Record<string, string> = {};
  if (!values.name) fieldErrors.name = "Escribe el nombre del plan.";
  else if (values.name.length > 180) fieldErrors.name = "Usa hasta 180 caracteres.";
  const priceDate = parseDate(values.priceDate);
  if (!priceDate) fieldErrors.priceDate = "Elige la fecha de referencia de los precios.";
  if (Object.keys(fieldErrors).length) return { error: "Revisa los datos marcados.", fieldErrors, values };
  const supabase = await createClient();
  const { error } = await supabase
    .from("production_plans")
    .update({ name: values.name, price_date: priceDate!, no_cif: values.noCif === "on", no_expenses: values.noExpenses === "on", calculation_hash: null })
    .eq("restaurant_id", r.id)
    .eq("id", planId);
  if (error) return { error: dbMessage(error, "No pudimos guardar el plan."), values };
  refresh();
  return { message: "Plan guardado.", values };
}

/** Agrega un plato al plan con precio manual (legacy: plan_line nueva + selected_plan_lines). */
export async function addPlanLine(_prev: PlanState, fd: FormData): Promise<PlanState> {
  const values = { productId: text(fd, "productId"), quantity: text(fd, "quantity"), price: text(fd, "price"), factor: text(fd, "factor") || "1" };
  const ctx = await getAppContext();
  const r = ctx.restaurant;
  const planId = int(fd, "planId");
  const productId = int(fd, "productId");
  if (!r || !canEdit(r.role) || !planId) return { error: "No tienes permiso para editar este plan.", values };
  if (!productId) return { error: "Elige un plato.", fieldErrors: { productId: "Elige un plato." }, values };
  const parsed = parsePlanLine({
    quantity: values.quantity,
    referencePrice: "0",
    equivalentFactor: values.factor,
    pricingMode: "manual",
    pricingValue: values.price,
    adoptedPrice: "",
  });
  if ("errors" in parsed) {
    const e = parsed.errors;
    return { error: "Revisa los datos marcados.", fieldErrors: { quantity: e.quantity, price: e.pricingValue, factor: e.equivalentFactor } as Record<string, string>, values };
  }
  if (new D(parsed.value.pricingValue).lte(0)) return { error: "Indica el precio final mayor que cero.", fieldErrors: { price: "Debe ser mayor que cero." }, values };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("plan_lines").select("id").eq("plan_id", planId).eq("product_id", productId).maybeSingle();
  if (existing) return { error: "Este plato ya está en el plan. Edita su línea existente.", values };
  const { error } = await supabase.rpc("save_plan_line", {
    p_plan: planId,
    p_product: productId,
    p_quantity: parsed.value.quantity,
    // Venta de referencia = precio con IGV ÷ (1 + tasa del restaurante) (legacy: values["price"] / (1 + tax)).
    p_reference_price: new D(parsed.value.pricingValue).div(new D(r.igvRate).plus(1)).toFixed(),
    p_equivalent_factor: parsed.value.equivalentFactor,
    p_pricing_mode: "manual",
    p_pricing_value: parsed.value.pricingValue,
    p_adopted_price: null,
  });
  if (error) return { error: dbMessage(error, "No pudimos agregar el plato."), values };
  refresh();
  return { message: "Plato agregado al plan." };
}

/** Revisa el cálculo y guarda su huella (legacy: calculate). Publicar exige que la huella siga vigente. */
export async function reviewPlan(fd: FormData) {
  const ctx = await getAppContext();
  const r = ctx.restaurant;
  const planId = int(fd, "planId");
  if (!r || !canEdit(r.role) || !planId) return;
  const plan = await getPlan(r.id, planId);
  if (!plan) return;
  const { fingerprint } = await evaluatePlan(r.id, plan, { name: r.name, currency: r.currency });
  const supabase = await createClient();
  await supabase.from("production_plans").update({ calculation_hash: fingerprint }).eq("restaurant_id", r.id).eq("id", planId);
  refresh();
}
