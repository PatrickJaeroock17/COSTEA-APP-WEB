// Base de pruebas: todas las migraciones en PGlite (Postgres en WebAssembly) con un esquema `auth` mínimo
// que imita a Supabase (auth.users, auth.uid(), roles anon/authenticated). Sirve para probar RLS y funciones
// sin conectarse al proyecto real.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

export async function createDb() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth;
    grant usage on schema auth to authenticated, anon;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    grant execute on function auth.uid() to authenticated, anon;
    grant usage on schema public to authenticated, anon;
  `);
  for (const file of readdirSync(MIGRATIONS).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), "utf8").replace(/^﻿/, ""));
  }

  /** Ejecuta como usuario con sesión (rol authenticated + auth.uid()). */
  async function as<T = Record<string, unknown>>(uid: string, sql: string, params: unknown[] = []) {
    await db.exec(`reset role; select set_config('test.uid', '${uid}', false); set role authenticated;`);
    try {
      return (await db.query<T>(sql, params)).rows;
    } finally {
      await db.exec("reset role;");
    }
  }

  /** Devuelve el error de Postgres (o null si la sentencia se ejecutó). */
  async function fails(uid: string, sql: string, params: unknown[] = []) {
    try {
      await as(uid, sql, params);
      return null;
    } catch (e) {
      return e as { code?: string; message: string; detail?: string; hint?: string };
    }
  }

  /** Crea un usuario como lo haría Supabase Auth (dispara handle_new_user). */
  async function signUp(id: string, meta: Record<string, string>) {
    await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [id, `${id.slice(-4)}@prueba.pe`, meta]);
  }

  return { db, as, fails, signUp };
}

export const uid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
