"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { PERIOD_COOKIE, RESTAURANT_COOKIE, getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; message?: string; values?: Record<string, string> };

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Origen público del sitio, para los enlaces de correo y el retorno de Google. */
async function origin() {
  const h = await headers();
  return process.env.NEXT_PUBLIC_SITE_URL ?? h.get("origin") ?? `http://${h.get("host") ?? "localhost:3000"}`;
}

/** Solo rutas internas (evita redirecciones abiertas). */
function safeNext(value: string | null | undefined, fallback = "/app") {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function translate(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "Aún no confirmas tu correo. Revisa tu bandeja de entrada (y la de spam).";
  if (m.includes("already registered") || m.includes("already been registered")) return "Ya existe una cuenta con ese correo. Inicia sesión.";
  if (m.includes("password should be") || m.includes("weak password")) return "La contraseña es muy débil. Usa al menos 8 caracteres.";
  if (m.includes("rate limit") || m.includes("too many")) return "Demasiados intentos. Espera unos minutos y vuelve a probar.";
  if (m.includes("provider is not enabled") || m.includes("unsupported provider"))
    return "El ingreso con Google aún no está activado en Supabase.";
  if (m.includes("same password") || m.includes("different from the old")) return "La nueva contraseña debe ser distinta de la anterior.";
  return "No pudimos completar la operación. Inténtalo otra vez.";
}

export async function signIn(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = text(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!EMAIL.test(email) || !password) return { error: "Escribe tu correo y tu contraseña.", values: { email } };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: translate(error.message), values: { email } };
  redirect(safeNext(text(fd, "next")));
}

export async function signUp(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = { name: text(fd, "name"), restaurant: text(fd, "restaurant"), email: text(fd, "email").toLowerCase() };
  const password = String(fd.get("password") ?? "");
  if (!values.name || !values.restaurant) return { error: "Completa tu nombre y el de tu restaurante.", values };
  if (values.name.length > 100 || values.restaurant.length > 180) return { error: "El nombre es demasiado largo.", values };
  if (!EMAIL.test(values.email)) return { error: "Escribe un correo válido.", values };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres.", values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password,
    // El trigger handle_new_user crea el perfil y el restaurante con estos datos.
    options: { data: { name: values.name, restaurant: values.restaurant }, emailRedirectTo: `${await origin()}/auth/callback` },
  });
  if (error) return { error: translate(error.message), values };
  if (data.session) redirect("/app");
  return {
    message: `Te enviamos un correo a ${values.email}. Abre el enlace para activar tu cuenta y entrar.`,
    values,
  };
}

export async function signInWithGoogle(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const next = safeNext(text(fd, "next"));
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) return { error: translate(error?.message ?? "") };
  redirect(data.url);
}

export async function requestPasswordReset(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = text(fd, "email").toLowerCase();
  if (!EMAIL.test(email)) return { error: "Escribe un correo válido.", values: { email } };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origin()}/auth/callback?next=/nueva-clave`,
  });
  if (error && /rate limit|too many/i.test(error.message)) return { error: translate(error.message), values: { email } };
  // Mismo mensaje exista o no la cuenta: no revela qué correos están registrados.
  return { message: `Si ${email} tiene una cuenta, te llegará un enlace para crear una nueva contraseña.`, values: { email } };
}

export async function updatePassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (!(await getUser())) return { error: "El enlace venció. Pide uno nuevo desde «¿Olvidaste tu contraseña?»." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: translate(error.message) };
  redirect("/app");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const jar = await cookies();
  jar.delete(RESTAURANT_COOKIE);
  jar.delete(PERIOD_COOKIE);
  redirect("/ingresar");
}
