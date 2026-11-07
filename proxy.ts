import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/**
 * Renueva la sesión de Supabase en cada petición y hace redirecciones optimistas:
 * /app sin sesión → /ingresar; /ingresar o /registro con sesión → /app.
 * No es la única barrera: cada página y acción del servidor vuelve a verificar al usuario, y RLS protege los datos.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list, headers) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // getClaims valida el token; no usar getSession en el servidor.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    if (path === "/ingresar") url.searchParams.set("next", pathname + search);
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!signedIn && (pathname === "/app" || pathname.startsWith("/app/"))) return redirectTo("/ingresar");
  if (signedIn && (pathname === "/ingresar" || pathname === "/registro")) return redirectTo("/app");

  return response;
}

export const config = {
  matcher: [
    // Todo excepto archivos estáticos y los cuadros del chef.
    "/((?!_next/static|_next/image|brand/|chef/|chef-m/|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|ico)$).*)",
  ],
};