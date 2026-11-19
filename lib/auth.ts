import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type CostLevel, parseCostLevel } from "@/lib/cost-level";
import { displayName, periodLabel } from "@/lib/restaurants";

export const RESTAURANT_COOKIE = "costea_restaurante";
export const PERIOD_COOKIE = "costea_periodo";

export type Role = "owner" | "editor" | "viewer";
export type AppRestaurant = { id: string; name: string };
export type AppPeriod = { id: number; year: number; month: number; label: string; taxRate: number | null };
export type ActiveRestaurant = {
  id: string;
  name: string;
  legalName: string;
  tradeName: string | null;
  taxIdKind: string;
  taxId: string | null;
  currency: string;
  /** Tasa de IGV del restaurante como fracción exacta ("0.180000"). */
  igvRate: string;
  /** Nivel de costeo: 1 rápido, 2 con mi tiempo, 3 completo (solo presentación). */
  costLevel: CostLevel;
  role: Role;
};
export type AppContext = {
  user: { id: string; email: string; name: string };
  restaurants: AppRestaurant[];
  restaurantId: string | null;
  restaurant: ActiveRestaurant | null;
  periods: AppPeriod[];
  periodId: number | null;
  period: AppPeriod | null;
};

/** Usuario con sesión o null. Una sola lectura por petición. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: String(claims.email ?? "") };
});

/**
 * Contexto del sistema (/app): usuario, restaurantes visibles por RLS, restaurante y mes de trabajo.
 * Las cookies solo guardan la preferencia: se revalidan en cada petición (legacy: resolve_workspace).
 * Redirige a /ingresar si no hay sesión.
 */
export const getAppContext = cache(async (): Promise<AppContext> => {
  const user = await getUser();
  if (!user) redirect("/ingresar");

  const supabase = await createClient();
  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", user.id).maybeSingle(),
    supabase
      .from("restaurants")
      .select("id, legal_name, trade_name, tax_id_kind, tax_id, currency, igv_rate::text, cost_level")
      .eq("active", true)
      .order("created_at"),
  ]);

  const list = rows ?? [];
  const jar = await cookies();
  const chosen = jar.get(RESTAURANT_COOKIE)?.value;
  const active = list.find((r) => r.id === chosen) ?? list[0] ?? null;

  let restaurant: ActiveRestaurant | null = null;
  let periods: AppPeriod[] = [];
  if (active) {
    const [{ data: member }, { data: periodRows }] = await Promise.all([
      supabase.from("restaurant_members").select("role").eq("restaurant_id", active.id).eq("user_id", user.id).maybeSingle(),
      supabase
        .from("periods")
        .select("id, year, month, tax_rate")
        .eq("restaurant_id", active.id)
        .order("year", { ascending: false })
        .order("month", { ascending: false }),
    ]);
    restaurant = {
      id: active.id,
      name: displayName(active),
      legalName: active.legal_name,
      tradeName: active.trade_name,
      taxIdKind: active.tax_id_kind,
      taxId: active.tax_id,
      currency: active.currency,
      igvRate: (active as unknown as { igv_rate: string }).igv_rate,
      costLevel: parseCostLevel((active as unknown as { cost_level: number }).cost_level),
      role: (member?.role as Role) ?? "viewer",
    };
    periods = (periodRows ?? []).map((p) => ({
      id: p.id,
      year: p.year,
      month: p.month,
      label: periodLabel(p.year, p.month),
      taxRate: p.tax_rate,
    }));
  }

  // El mes elegido debe pertenecer al restaurante activo; si no, el más reciente.
  const chosenPeriod = Number(jar.get(PERIOD_COOKIE)?.value);
  const period = periods.find((p) => p.id === chosenPeriod) ?? periods[0] ?? null;

  return {
    user: { ...user, name: profile?.name || user.email.split("@")[0] },
    restaurants: list.map((r) => ({ id: r.id, name: displayName(r) })),
    restaurantId: restaurant?.id ?? null,
    restaurant,
    periods,
    periodId: period?.id ?? null,
    period,
  };
});

export const canEdit = (role: Role | undefined) => role === "owner" || role === "editor";
