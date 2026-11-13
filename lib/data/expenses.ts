import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AllocationBasis, ConceptKind } from "@/lib/costing/costing";
import { fetchAll } from "@/lib/data/materials";

export type ConceptRow = {
  id: number;
  period_id: number;
  name: string;
  reference_key: string | null;
  kind: ConceptKind;
  amount: string;
  basis: AllocationBasis;
  behavior: "fixed" | "variable";
  justification: string;
  targets: number[];
  active: boolean;
};

const COLUMNS = "id, period_id, name, reference_key, kind, amount::text, basis, behavior, justification, targets, active";

export async function getConcepts(restaurantId: string, periodId: number): Promise<ConceptRow[]> {
  const supabase = await createClient();
  return fetchAll<ConceptRow>((a, b) =>
    supabase.from("cost_concepts").select(COLUMNS).eq("restaurant_id", restaurantId).eq("period_id", periodId).order("name").range(a, b) as never,
  );
}

export async function getConcept(restaurantId: string, id: number): Promise<ConceptRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("cost_concepts").select(COLUMNS).eq("restaurant_id", restaurantId).eq("id", id).maybeSingle();
  return (data as unknown as ConceptRow) ?? null;
}

/** Platos del restaurante para elegir destinatarios. */
export async function getProductChoices(restaurantId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("id, name, active").eq("restaurant_id", restaurantId).order("name");
  return (data ?? []) as { id: number; name: string; active: boolean }[];
}
