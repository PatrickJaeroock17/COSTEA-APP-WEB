import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/** Cliente de Supabase para Server Components, Server Actions y Route Handlers (uno por petición). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(list) {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Llamado desde un Server Component: no puede escribir cookies. El proxy ya renueva la sesión.
        }
      },
    },
  });
}