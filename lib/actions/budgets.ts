"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { canEdit, getAppContext } from "@/lib/auth";
import { plain } from "@/lib/costing/decimal";
import { evaluatePlan, getPlan } from "@/lib/data/plan";
import { createClient } from "@/lib/supabase/server";

export type BudgetState = { error?: string };

/**
 * Publica el plan como presupuesto (legacy: publish). Recalcula en el servidor y exige que el cálculo
 * esté completo y que la huella revisada siga siendo la que vio el usuario; la base vuelve a verificarla,
 * guarda la fotografía y registra las salidas del kardex en la misma transacción.
 */
export async function publishBudget(_prev: BudgetState, fd: FormData): Promise<BudgetState> {
  const ctx = await getAppContext();
  const r = ctx.restaurant;
  const planId = Number(fd.get("planId"));
  if (!r || !canEdit(r.role) || !Number.isInteger(planId)) return { error: "No tienes permiso para publicar este plan." };
  const plan = await getPlan(r.id, planId);
  if (!plan) return { error: "El plan ya no existe." };
  const { input, result, fingerprint } = await evaluatePlan(r.id, plan, { name: r.name, currency: r.currency });
  if (result.status !== "calculable" || plan.calculation_hash !== fingerprint || String(fd.get("fingerprint")) !== fingerprint) {
    return { error: "No se publicó: faltan datos o cambiaron las entradas. Revisa el cálculo y vuelve a intentarlo." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_budget", {
    p_plan: plan.id,
    p_fingerprint: fingerprint,
    p_snapshot: plain({ input, result }) as never,
  });
  if (error || !data) return { error: error?.code === "P0001" && error.message ? error.message : "No pudimos publicar el presupuesto." };
  redirect(`/app/presupuestos/${data}?publicado=1`);
}

/** Archiva o vuelve a mostrar un presupuesto; nunca se borra (legacy: budget_toggle). */
export async function setBudgetArchived(fd: FormData) {
  const ctx = await getAppContext();
  const r = ctx.restaurant;
  const id = Number(fd.get("budgetId"));
  if (!r || !canEdit(r.role) || !Number.isInteger(id)) return;
  const supabase = await createClient();
  const { data } = await supabase.from("budgets").select("id").eq("restaurant_id", r.id).eq("id", id).maybeSingle();
  if (!data) return;
  await supabase.from("budget_archives").upsert({ budget_id: id, restaurant_id: r.id, archived: fd.get("state") === "archived" }, { onConflict: "budget_id" });
  refresh();
}
