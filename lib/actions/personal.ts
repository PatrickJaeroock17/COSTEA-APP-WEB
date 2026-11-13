"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { canEdit, getAppContext } from "@/lib/auth";
import { parseAmount } from "@/lib/materials";
import { parsePayroll } from "@/lib/personal";
import { createClient } from "@/lib/supabase/server";

export type PersonalState = {
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
const fold = (s: string) => s.toLocaleLowerCase("es").split(/\s+/).filter(Boolean).join(" ");

function dbMessage(error: { code?: string; message?: string } | null, fallback: string) {
  if (!error) return fallback;
  if (error.code === "P0001" && error.message) return error.message;
  if (error.code === "42501") return "No tienes permiso para hacer este cambio.";
  if (error.code === "23505") return "Ya existe un trabajador con ese documento en el restaurante.";
  return fallback;
}

async function editableRestaurant() {
  const ctx = await getAppContext();
  if (!ctx.restaurant || !canEdit(ctx.restaurant.role)) return null;
  return ctx;
}

/* ───────────── Trabajadores ───────────── */

function employeeValues(fd: FormData) {
  return { name: text(fd, "name"), role: text(fd, "role"), document: text(fd, "document") };
}

function validateEmployee(v: { name: string; role: string; document: string }) {
  const errors: Record<string, string> = {};
  if (!v.name) errors.name = "Escribe el nombre del trabajador.";
  else if (v.name.length > 180) errors.name = "Usa hasta 180 caracteres.";
  if (!v.role) errors.role = "Escribe el cargo.";
  else if (v.role.length > 180) errors.role = "Usa hasta 180 caracteres.";
  if (v.document.length > 40) errors.document = "Usa hasta 40 caracteres.";
  return errors;
}

/** legacy: mismo documento, o mismo nombre cuando no hay documento. */
async function duplicate(restaurantId: string, v: { name: string; document: string }, exclude?: number) {
  const supabase = await createClient();
  const { data } = await supabase.from("employees").select("id, name, document").eq("restaurant_id", restaurantId);
  return (data ?? []).some(
    (e) =>
      e.id !== exclude &&
      ((v.document && e.document && fold(e.document) === fold(v.document)) || (!v.document && fold(e.name) === fold(v.name))),
  );
}

const DUPLICATE = "Este trabajador ya está registrado. Edita el registro existente; si son personas distintas con el mismo nombre, indica su documento.";

export async function createEmployee(_prev: PersonalState, fd: FormData): Promise<PersonalState> {
  const values = employeeValues(fd);
  const ctx = await editableRestaurant();
  if (!ctx) return { error: "No tienes permiso para agregar personal.", values };
  const errors = validateEmployee(values);
  if (Object.keys(errors).length) return { error: "Revisa los datos marcados.", fieldErrors: errors, values };
  if (await duplicate(ctx.restaurant!.id, values)) return { error: DUPLICATE, fieldErrors: { name: DUPLICATE }, values };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .insert({ restaurant_id: ctx.restaurant!.id, name: values.name, role: values.role, document: values.document || null })
    .select("id")
    .single();
  if (error || !data) return { error: dbMessage(error, "No pudimos registrar al trabajador."), values };
  redirect(`/app/personal/${data.id}?nuevo=1`);
}

export async function updateEmployee(_prev: PersonalState, fd: FormData): Promise<PersonalState> {
  const values = { ...employeeValues(fd), active: text(fd, "active") };
  const ctx = await editableRestaurant();
  const id = int(fd, "employeeId");
  if (!ctx || !id) return { error: "No tienes permiso para editar personal.", values };
  const errors = validateEmployee(values);
  if (Object.keys(errors).length) return { error: "Revisa los datos marcados.", fieldErrors: errors, values };
  if (await duplicate(ctx.restaurant!.id, values, id)) return { error: DUPLICATE, fieldErrors: { name: DUPLICATE }, values };
  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({ name: values.name, role: values.role, document: values.document || null, active: values.active === "on" })
    .eq("restaurant_id", ctx.restaurant!.id)
    .eq("id", id);
  if (error) return { error: dbMessage(error, "No pudimos guardar los datos."), values };
  refresh();
  return { message: "Datos guardados. Desactivar conserva sus costos y operaciones históricas." };
}

export async function deleteEmployee(_prev: PersonalState, fd: FormData): Promise<PersonalState> {
  const ctx = await editableRestaurant();
  const id = int(fd, "employeeId");
  if (!ctx || !id) return { error: "No tienes permiso para eliminar personal." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_employee", { p_employee: id });
  if (error) return { error: dbMessage(error, "No pudimos eliminar al trabajador.") };
  redirect("/app/personal?eliminado=1");
}

/* ───────────── Costo mensual ───────────── */

export async function savePayroll(_prev: PersonalState, fd: FormData): Promise<PersonalState> {
  const values = Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
  const ctx = await editableRestaurant();
  const employeeId = int(fd, "employeeId");
  const periodId = int(fd, "periodId");
  if (!ctx || !employeeId) return { error: "No tienes permiso para editar personal.", values };
  if (!periodId || !ctx.periods.some((p) => p.id === periodId)) return { error: "Elige un mes de trabajo del restaurante.", values };
  const parsed = parsePayroll(values);
  if ("errors" in parsed) return { error: parsed.errors.mode ?? "Revisa los datos marcados.", fieldErrors: parsed.errors, values };

  const supabase = await createClient();
  const { data: employee } = await supabase.from("employees").select("id").eq("restaurant_id", ctx.restaurant!.id).eq("id", employeeId).maybeSingle();
  if (!employee) return { error: "El trabajador no existe en este restaurante.", values };
  const { error } = await supabase.from("employee_period_costs").upsert(
    {
      restaurant_id: ctx.restaurant!.id,
      employee_id: employeeId,
      period_id: periodId,
      data: parsed.ok.data as never,
      breakdown: parsed.ok.breakdown as never,
    },
    { onConflict: "employee_id,period_id" },
  );
  if (error) return { error: dbMessage(error, "No pudimos guardar el costo mensual."), values };
  refresh();
  return { message: "Costo mensual guardado. La parte indirecta pasa sola a gastos, sin duplicar la planilla.", values };
}

/* ───────────── Mano de obra por receta ───────────── */

export async function addOperation(_prev: PersonalState, fd: FormData): Promise<PersonalState> {
  const values = { employeeId: text(fd, "employeeId"), activity: text(fd, "activity"), minutes: text(fd, "minutes") };
  const ctx = await editableRestaurant();
  const recipe = int(fd, "recipeId");
  const employee = int(fd, "employeeId");
  if (!ctx || !recipe) return { error: "No tienes permiso para editar esta receta.", values };
  const errors: Record<string, string> = {};
  if (!employee) errors.employeeId = "Elige un trabajador.";
  if (!values.activity) errors.activity = "Describe la actividad.";
  const minutes = parseAmount(values.minutes);
  if ("error" in minutes) errors.minutes = minutes.error;
  if (Object.keys(errors).length) return { error: "Revisa los datos marcados.", fieldErrors: errors, values };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_operation", { p_recipe: recipe, p_employee: employee!, p_activity: values.activity, p_minutes: (minutes as { value: string }).value });
  if (error) return { error: dbMessage(error, "No pudimos agregar la operación."), values };
  refresh();
  return { message: "Operación agregada." };
}

export async function removeOperation(fd: FormData) {
  const ctx = await editableRestaurant();
  const recipe = int(fd, "recipeId");
  const position = Number(text(fd, "position"));
  if (!ctx || !recipe || !Number.isInteger(position) || position < 0) return;
  const supabase = await createClient();
  await supabase.rpc("remove_operation", { p_recipe: recipe, p_position: position });
  refresh();
}

export async function setRecipeWork(_prev: PersonalState, fd: FormData): Promise<PersonalState> {
  const ctx = await editableRestaurant();
  const recipe = int(fd, "recipeId");
  if (!ctx || !recipe) return { error: "No tienes permiso para editar esta receta." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_recipe_work", { p_recipe: recipe, p_no_materials: fd.get("noMaterials") === "on", p_no_labor: fd.get("noLabor") === "on" });
  if (error) return { error: dbMessage(error, "No pudimos guardar la aplicabilidad.") };
  refresh();
  return { message: "Aplicabilidad guardada para esta versión de receta." };
}
