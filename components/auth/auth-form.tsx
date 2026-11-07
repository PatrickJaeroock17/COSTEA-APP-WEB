"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AuthPanel } from "@/components/auth/auth-panel";
import { Logo } from "@/components/brand/logo";

type Field = { name: string; label: string; type: string; placeholder: string; autoComplete: string; minLength?: number };

const input =
  "mt-2 h-14 w-full rounded-2xl border border-[#d7dfdb] bg-white px-4 text-base text-[#12251f] placeholder:text-[#8a9a93] outline-none transition-colors focus:border-[#006b4b] focus:ring-4 focus:ring-[#006b4b]/15";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const login = mode === "login";

  const fields: Field[] = login
    ? [{ name: "email", label: "Correo electrónico", type: "email", placeholder: "nombre@correo.com", autoComplete: "email" }]
    : [
        { name: "name", label: "Tu nombre", type: "text", placeholder: "Patrick", autoComplete: "name" },
        { name: "restaurant", label: "Nombre de tu restaurante", type: "text", placeholder: "Mi restaurante", autoComplete: "organization" },
        { name: "email", label: "Correo electrónico", type: "email", placeholder: "nombre@correo.com", autoComplete: "email" },
      ];

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f9f7] lg:grid lg:grid-cols-[1.08fr_1fr]">
      <AuthPanel />
      <main className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-12 lg:px-16 xl:px-24">
        <Logo className="mb-10 lg:hidden" />
        <div className="mx-auto w-full max-w-[440px]">
          <h1 className="font-brand text-[34px] font-extrabold leading-tight tracking-[-0.02em] text-[#032a1f] sm:text-4xl">
            {login ? "Ingresa a tu cuenta" : "Crea tu cuenta"}
          </h1>
          <p className="mt-3 text-lg leading-snug text-[#5b6b65]">
            {login ? "Bienvenido de nuevo. Continúa con el costeo de tu restaurante." : "Empieza a costear tu restaurante en minutos."}
          </p>

          {/* Fase 3 conectará este formulario con Supabase Auth. Por ahora entra en modo demostración. */}
          <form
            className="mt-8 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              router.push("/app");
            }}
          >
            {fields.map((f) => (
              <label key={f.name} className="block text-[15px] font-semibold text-[#12251f]">
                {f.label}
                <input name={f.name} type={f.type} required placeholder={f.placeholder} autoComplete={f.autoComplete} className={input} />
              </label>
            ))}

            <div>
              <div className="flex items-center justify-between text-[15px] font-semibold text-[#12251f]">
                <label htmlFor="password">Contraseña</label>
                {login && (
                  <button type="button" className="text-sm font-semibold text-[#006b4b] hover:underline">¿Olvidaste tu contraseña?</button>
                )}
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={show ? "text" : "password"}
                  required
                  minLength={login ? undefined : 8}
                  placeholder={login ? "Tu contraseña" : "Mínimo 8 caracteres"}
                  autoComplete={login ? "current-password" : "new-password"}
                  className={`${input} pr-14`}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-2 top-4 grid size-10 place-items-center rounded-xl text-[#5b6b65] hover:bg-[#f6f9f7]"
                >
                  {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="h-14 w-full rounded-2xl bg-[#006b4b] text-base font-extrabold text-white transition-colors hover:bg-[#00563d] active:scale-[0.99]"
            >
              {login ? "Iniciar sesión" : "Crear cuenta"}
            </button>
          </form>

          <p className="mt-6 text-center text-[15px] text-[#5b6b65]">
            {login ? "¿Aún no tienes cuenta? " : "¿Ya tienes cuenta? "}
            <Link href={login ? "/registro" : "/ingresar"} className="font-bold text-[#006b4b] hover:underline">
              {login ? "Crea una gratis" : "Inicia sesión"}
            </Link>
          </p>
          <p className="mt-8 rounded-2xl bg-[#fef3d8] px-4 py-3 text-center text-sm text-[#7a5a12]">
            Modo demostración: el acceso real se conecta en la siguiente fase.
          </p>
        </div>
      </main>
    </div>
  );
}
