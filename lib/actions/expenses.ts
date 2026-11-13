"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { canEdit, getAppContext } from "@/lib/auth";
import { normalize, parseConcept } from "@/lib/expenses";
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
  if (conceptId) {
    refresh();
    return { message: "Gasto guardado." };
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
