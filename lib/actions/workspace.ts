"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { PERIOD_COOKIE, RESTAURANT_COOKIE, canEdit, getAppContext, getUser } from "@/lib/auth";
import { RESTAURANT_TAX_RATE, parseMonthKey, validateRestaurant } from "@/lib/restaurants";
import { createClient } from "@/lib/supabase/server";

export type WorkspaceState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

const YEAR = 60 * 60 * 24 * 365;
const cookieOptions = { path: "/", httpOnly: true, sameSite: "lax" as const, maxAge: YEAR };
const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/ingresar");
  return user;
}

async function setActiveRestaurant(id: string) {
  const jar = await cookies();
  jar.set(RESTAURANT_COOKIE, id, cookieOptions);
  jar.delete(PERIOD_COOKIE); // Al cambiar de restaurante, el mes vuelve al más reciente.
}

function dbError(error: { code?: string; message?: string } | null, fallback: string) {
  if (!error) return fallback;
  if (error.code === "23505") return "Ya tienes un restaurante con ese identificador. Revisa también los archivados.";
  if (error.code === "P0001" && error.message) return error.message;
  if (error.code === "42501") return "No tienes permiso para hacer este cambio.";
  return fallback;
}

/* ───────────── Selección de restaurante y mes ───────────── */

/** Cambia el restaurante de trabajo. RLS garantiza que solo se aceptan restaurantes del usuario. */
export async function selectRestaurant(id: string) {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("restaurants").select("id").eq("id", id).eq("active", true).maybeSingle();
  if (data) await setActiveRestaurant(data.id);
}

/** Cambia el mes de trabajo; solo meses del restaurante activo. */
export async function selectPeriod(id: number) {
  await requireUser();
  const { periods } = await getAppContext();
  if (periods.some((p) => p.id === id)) (await cookies()).set(PERIOD_COOKIE, String(id), cookieOptions);
}

/* ───────────── Restaurantes ───────────── */

/** Crea un restaurante con su primer mes en una sola transacción (RPC create_restaurant). */
export async function createRestaurant(_prev: WorkspaceState, fd: FormData): Promise<WorkspaceState> {
  await requireUser();
  // El paso de bienvenida solo envía «restaurant» (nombre).
  const raw = {
    legalName: text(fd, "legalName") || text(fd, "restaurant"),
    tradeName: text(fd, "tradeName"),
    taxIdKind: text(fd, "taxIdKind"),
    taxId: text(fd, "taxId"),
    currency: text(fd, "currency"),
  };
  const { values, errors } = validateRestaurant(raw);
  const month = text(fd, "month");
  const fieldErrors: Record<string, string> = { ...errors };
  let parsed: { year: number; month: number } | null = null;
  if (month) {
    const m = parseMonthKey(month);
    if ("error" in m) fieldErrors.month = m.error;
    else parsed = m;
  }
  const echo = { ...raw, restaurant: raw.legalName, month };
  if (Object.keys(fieldErrors).length) {
    return { error: fieldErrors.legalName && fd.has("restaurant") ? fieldErrors.legalName : "Revisa los datos marcados.", fieldErrors, values: echo };
  }

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("create_restaurant", {
    p_legal_name: values.legalName,
    p_trade_name: values.tradeName || null,
    p_tax_id_kind: values.taxIdKind,
    p_tax_id: values.taxId || null,
    p_currency: values.currency,
    p_year: parsed?.year ?? null,
    p_month: parsed?.month ?? null,
  });
  if (error || !id) {
    const message = dbError(error, "No pudimos crear el restaurante. Inténtalo otra vez.");
    return { error: message, fieldErrors: error?.code === "23505" ? { taxId: message } : undefined, values: echo };
  }
  await setActiveRestaurant(id);
  redirect(text(fd, "next") === "configuracion" ? "/app/configuracion?seccion=restaurante&creado=1" : "/app");
}

/** Edita los datos del restaurante activo (solo el dueño). Los periodos existentes conservan su impuesto. */
export async function updateRestaurant(_prev: WorkspaceState, fd: FormData): Promise<WorkspaceState> {
  await requireUser();
  const { restaurant } = await getAppContext();
  const raw = Object.fromEntries(["legalName", "tradeName", "taxIdKind", "taxId", "currency"].map((k) => [k, text(fd, k)]));
  if (!restaurant || restaurant.role !== "owner") return { error: "Solo el dueño puede cambiar los datos del restaurante.", values: raw };
  const { values, errors } = validateRestaurant(raw);
  if (Object.keys(errors).length) return { error: "Revisa los datos marcados.", fieldErrors: errors, values: raw };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurants")
    .update({
      legal_name: values.legalName,
      trade_name: values.tradeName || null,
      tax_id_kind: values.taxIdKind,
      tax_id: values.taxId || null,
      currency: values.currency,
    })
    .eq("id", restaurant.id)
    .select("id");
  if (error || !data?.length) {
    const message = dbError(error, "No pudimos guardar los cambios. Inténtalo otra vez.");
    const field = error?.code === "23505" ? "taxId" : error?.code === "P0001" ? "currency" : null;
    return { error: message, fieldErrors: field ? { [field]: message } : undefined, values: raw };
  }
  refresh();
  return { message: "Datos guardados." };
}

/** Archiva (no borra): sus datos se conservan y puede restaurarse. */
export async function archiveRestaurant(fd: FormData) {
  await requireUser();
  const id = text(fd, "id");
  const supabase = await createClient();
  const { data } = await supabase.from("restaurants").update({ active: false }).eq("id", id).select("id");
  const jar = await cookies();
  if (data?.length && jar.get(RESTAURANT_COOKIE)?.value === id) {
    jar.delete(RESTAURANT_COOKIE);
    jar.delete(PERIOD_COOKIE);
  }
  refresh();
}

export async function restoreRestaurant(fd: FormData) {
  await requireUser();
  const supabase = await createClient();
  await supabase.from("restaurants").update({ active: true }).eq("id", text(fd, "id"));
  refresh();
}

/* ───────────── Periodos ───────────── */

export async function createPeriod(_prev: WorkspaceState, fd: FormData): Promise<WorkspaceState> {
  await requireUser();
  const { restaurant } = await getAppContext();
  const month = text(fd, "month");
  if (!restaurant || !canEdit(restaurant.role)) return { error: "No tienes permiso para agregar meses.", values: { month } };
  const parsed = parseMonthKey(month);
  if ("error" in parsed) return { error: parsed.error, fieldErrors: { month: parsed.error }, values: { month } };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("periods")
    .insert({ restaurant_id: restaurant.id, year: parsed.year, month: parsed.month, tax_rate: Number(RESTAURANT_TAX_RATE) })
    .select("id")
    .single();
  if (error || !data) {
    const message = error?.code === "23505" ? "Ese mes ya existe para el restaurante." : dbError(error, "No pudimos crear el mes.");
    return { error: message, fieldErrors: { month: message }, values: { month } };
  }
  (await cookies()).set(PERIOD_COOKIE, String(data.id), cookieOptions);
  return { message: "Mes agregado y seleccionado como mes de trabajo." };
}

/* ───────────── Unidades ───────────── */

/** Unidades habilitadas para el restaurante (al menos una). */
export async function saveUnits(_prev: WorkspaceState, fd: FormData): Promise<WorkspaceState> {
  await requireUser();
  const { restaurant } = await getAppContext();
  if (!restaurant || !canEdit(restaurant.role)) return { error: "No tienes permiso para cambiar las unidades." };
  const chosen = new Set(fd.getAll("unit").map(String));
  if (!chosen.size) return { error: "Selecciona al menos una unidad." };

  const supabase = await createClient();
  const { data: units } = await supabase.from("units").select("code");
  const rows = (units ?? []).map((u) => ({ restaurant_id: restaurant.id, unit_code: u.code, enabled: chosen.has(u.code) }));
  if (!rows.some((r) => r.enabled)) return { error: "Selecciona al menos una unidad." };
  const { error } = await supabase.from("restaurant_units").upsert(rows, { onConflict: "restaurant_id,unit_code" });
  if (error) return { error: dbError(error, "No pudimos guardar las unidades.") };
  refresh();
  return { message: "Unidades guardadas." };
}
