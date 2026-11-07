import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const RESTAURANT_COOKIE = "costea_restaurante";

export type AppRestaurant = { id: string; name: string };
export type AppContext = {
  user: { id: string; email: string; name: string };
  restaurants: AppRestaurant[];
  restaurantId: string | null;
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
 * Contexto del sistema (/app): usuario, perfil y restaurantes visibles por RLS.
 * Redirige a /ingresar si no hay sesión.
 */
export const getAppContext = cache(async (): Promise<AppContext> => {
  const user = await getUser();
  if (!user) redirect("/ingresar");

  const supabase = await createClient();
  const [{ data: profile }, { data: restaurants }] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", user.id).maybeSingle(),
    supabase.from("restaurants").select("id, legal_name, trade_name").eq("active", true).order("created_at"),
  ]);

  const list = (restaurants ?? []).map((r) => ({ id: r.id, name: r.trade_name || r.legal_name }));
  const chosen = (await cookies()).get(RESTAURANT_COOKIE)?.value;
  const restaurantId = list.find((r) => r.id === chosen)?.id ?? list[0]?.id ?? null;

  return {
    user: { ...user, name: profile?.name || user.email.split("@")[0] },
    restaurants: list,
    restaurantId,
  };
});