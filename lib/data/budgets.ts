import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Resultado del motor tal como quedó guardado en la fotografía (importes como texto exacto). */
export type SnapshotPrice = { suggested: string; final: string; net: string; tax: string; result: string; margin: string | null; markup: string | null; costRatio: string | null };
export type SnapshotRow = {
  id: number;
  name: string;
  unit: string;
  quantity: string;
  cmp: string;
  mod: string;
  cif: string;
  expenses: string;
  complete: string | null;
  price: SnapshotPrice | null;
};
export type BudgetSnapshot = {
  input: { meta?: Record<string, string>; lines?: { id: number; pricingMode: string }[] };
  result: {
    engine: string;
    status: string;
    issues: string[];
    rows: SnapshotRow[];
    staff: { id: number; name: string; cost: string; assigned: string; idle: string; total: string }[];
    requirements: { materialId: number; name: string; unit: string; quantity: string; amount: string }[];
    totals: Record<string, string | null>;
  };
};

export type BudgetRow = {
  id: number;
  plan_id: number;
  number: number;
  fingerprint: string;
  created_at: string;
  archived: boolean;
  plan: { name: string; period_id: number } | null;
};

export async function getBudgets(restaurantId: string): Promise<BudgetRow[]> {
  const supabase = await createClient();
  const [{ data }, { data: archives }] = await Promise.all([
    supabase
      .from("budgets")
      .select("id, plan_id, number, fingerprint, created_at, production_plans(name, period_id)")
      .eq("restaurant_id", restaurantId)
      .order("id", { ascending: false }),
    supabase.from("budget_archives").select("budget_id, archived").eq("restaurant_id", restaurantId),
  ]);
  const archived = new Set(((archives ?? []) as { budget_id: number; archived: boolean }[]).filter((a) => a.archived).map((a) => a.budget_id));
  return ((data ?? []) as unknown as (Omit<BudgetRow, "archived" | "plan"> & { production_plans: BudgetRow["plan"] })[]).map((b) => ({
    id: b.id,
    plan_id: b.plan_id,
    number: b.number,
    fingerprint: b.fingerprint,
    created_at: b.created_at,
    plan: b.production_plans,
    archived: archived.has(b.id),
  }));
}

export async function getBudget(restaurantId: string, id: number) {
  const supabase = await createClient();
  const [{ data }, { data: archive }] = await Promise.all([
    supabase.from("budgets").select("id, plan_id, number, fingerprint, created_at, snapshot").eq("restaurant_id", restaurantId).eq("id", id).maybeSingle(),
    supabase.from("budget_archives").select("archived").eq("budget_id", id).maybeSingle(),
  ]);
  if (!data) return null;
  return { ...(data as unknown as { id: number; plan_id: number; number: number; fingerprint: string; created_at: string; snapshot: BudgetSnapshot }), archived: Boolean(archive?.archived) };
}
