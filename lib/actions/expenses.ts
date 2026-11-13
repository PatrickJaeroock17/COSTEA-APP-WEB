"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { canEdit, getAppContext } from "@/lib/auth";
import { normalize, parseConcept } from "@/lib/expenses";
import { parseAmount } from "@/lib/materials";
import { createClient } from "@/lib/supabase/server";

export type ExpenseState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string | string[]>;
};

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const DUPLICATE = "Este costo o comprobante ya existe en el mes. Edita el registro original para no duplicarlo.";

/** Crea o edita un gasto del mes de trabajo (legacy: concept_edit + save_concept). */
export async function saveConcept(_prev: ExpenseState, fd: FormData): Promise<ExpenseState> {
  const values = {
    ...Object.fromEntries(["name", "referenceKey", "kind", "amount", "behavior", "basis", "justification", "active"].map((k) => [k, text(fd, k)])),
    targets: fd.getAll("targets").map(String),
    ...Object.fromEntries(["allocationLineId", "allocationQuantity", "allocationReferencePrice", "allocationEquivalentFactor"].map((k) => [k, text(fd, k)])),
  };
  const ctx = await getAppContext();
  const r = ctx.restaurant;
  if (!r || !canEdit(r.role)) return { error: "No tienes permiso para registrar gastos.", values };
  const conceptId = Number(text(fd, "conceptId")) || null;
  const periodId = Number(text(fd, "periodId"));
  if (!ctx.periods.some((p) => p.id === periodId)) return { error: "Elige un mes de trabajo del restaurante.", values };

  const parsed = parseConcept(values);
  if ("errors" in parsed) return { error: "Revisa los datos marcados.", fieldErrors: parsed.errors, values };
  const v = parsed.value;
  const supabase = await createClient();

  // Opcional: completar el reparto de un plato del plan del mismo mes (legacy: allocation_line_id).
  const allocationLine = Number(text(fd, "allocationLineId")) || null;
  const alloc = {
    quantity: text(fd, "allocationQuantity"),
    referencePrice: text(fd, "allocationReferencePrice"),
    equivalentFactor: text(fd, "allocationEquivalentFactor"),
  };
  type Line = { plan_id: number; product_id: number; quantity: string; reference_price: string; equivalent_factor: string; pricing_mode: string; pricing_value: string; adopted_price: string | null };
  let line: Line | null = null;
  if (!allocationLine && Object.values(alloc).some(Boolean)) {
    return { error: "Selecciona el plato del plan cuyos datos deseas completar.", fieldErrors: { allocationLineId: "Elige el plato del plan." }, values };
  }
  if (allocationLine) {
    const allocErrors: Record<string, string> = {};
    for (const [key, raw] of Object.entries(alloc)) {
      if (!raw) continue;
      const p = parseAmount(raw, { positive: key !== "referencePrice" });
      if ("error" in p) allocErrors[`allocation${key[0].toUpperCase()}${key.slice(1)}`] = p.error;
      else alloc[key as keyof typeof alloc] = p.value;
    }
    if (Object.keys(allocErrors).length) return { error: "Revisa los datos del plato del plan.", fieldErrors: allocErrors, values };
    const { data } = await supabase
      .from("plan_lines")
      .select("plan_id, product_id, quantity::text, reference_price::text, equivalent_factor::text, pricing_mode, pricing_value::text, adopted_price::text, production_plans!inner(period_id)")
      .eq("restaurant_id", r.id)
      .eq("id", allocationLine)
      .maybeSingle();
    const found = data as unknown as (Line & { production_plans: { period_id: number } }) | null;
    if (!found || found.production_plans.period_id !== periodId) {
      return { error: "El plan seleccionado debe pertenecer al mismo mes del gasto.", fieldErrors: { allocationLineId: "Elige un plato de un plan de este mes." }, values };
    }
    line = found as Line;
  }

  // Duplicado por nombre o comprobante en el mismo mes (también lo impide la base).
  const { data: others } = await supabase.from("cost_concepts").select("id, name, reference_key").eq("restaurant_id", r.id).eq("period_id", periodId);
  const clash = (others ?? []).some(
    (c) => c.id !== conceptId && (normalize(c.name) === normalize(v.name) || c.reference_key === v.referenceKey),
  );
  if (clash) return { error: DUPLICATE, fieldErrors: { name: DUPLICATE }, values };

  const row = {
    restaurant_id: r.id,
    period_id: periodId,
    name: v.name,
    reference_key: v.referenceKey,
    kind: v.kind,
    amount: v.amount as unknown as number,
    basis: v.basis,
    behavior: v.behavior,
    justification: v.justification,
    targets: v.targets,
    active: v.active,
  };
  const { error } = conceptId
    ? await supabase.from("cost_concepts").update(row).eq("restaurant_id", r.id).eq("id", conceptId)
    : await supabase.from("cost_concepts").insert(row);
  if (error) {
    const message = error.code === "23505" ? DUPLICATE : error.code === "P0001" ? error.message : "No pudimos guardar el gasto.";
    return { error: message, fieldErrors: error.code === "23505" ? { name: message } : undefined, values };
  }
  if (line) {
    const { error: lineError } = await supabase.rpc("save_plan_line", {
      p_plan: line.plan_id,
      p_product: line.product_id,
      p_quantity: alloc.quantity || line.quantity,
      p_reference_price: alloc.referencePrice || line.reference_price,
      p_equivalent_factor: alloc.equivalentFactor || line.equivalent_factor,
      p_pricing_mode: line.pricing_mode,
      p_pricing_value: line.pricing_value,
      p_adopted_price: line.adopted_price,
    });
    if (lineError) return { error: `El gasto se guardó, pero no el plato del plan: ${lineError.message}`, values };
  }
  if (conceptId) {
    refresh();
    return { message: line ? "Gasto y plato del plan guardados." : "Gasto guardado." };
  }
  redirect("/app/gastos?guardado=1");
}

/** Incluir o excluir del cálculo, sin borrar (legacy: active). */
export async function setConceptActive(fd: FormData) {
  const ctx = await getAppContext();
  const r = ctx.restaurant;
  const id = Number(text(fd, "conceptId"));
  if (!r || !canEdit(r.role) || !Number.isInteger(id)) return;
  const supabase = await createClient();
  await supabase.from("cost_concepts").update({ active: text(fd, "state") === "active" }).eq("restaurant_id", r.id).eq("id", id);
  refresh();
}
