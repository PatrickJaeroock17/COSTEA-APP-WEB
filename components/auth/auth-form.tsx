"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, MousePointer2 } from "lucide-react";
import { ChefScrub } from "@/components/landing/chef-scrub";

type Field = { name: string; label: string; type: string; placeholder: string; autoComplete: string };

const input =
  "mt-1.5 h-12 w-full rounded-xl border border-transparent bg-[#f2f5f3] px-4 text-[15px] text-[#12251f] placeholder:text-[#8a9a93] outline-none transition-colors focus:border-[#006b4b] focus:bg-white focus:ring-4 focus:ring-[#006b4b]/12";

const copy = {
  login: {
    tagline: ["Costea.", "Ajusta.", "Gana."],
    title: "Bienvenido de nuevo",
    sub: "Ingresa tu correo y contraseña para continuar con tu restaurante.",
    submit: "Iniciar sesión",
    alt: ["¿No tienes cuenta?", "Regístrate", "/registro"],
  },
  register: {
    tagline: ["Tu carta.", "Tus números."],
    title: "Crea tu cuenta",
    sub: "Empieza a costear tu restaurante en minutos.",
    submit: "Crear cuenta",
    alt: ["¿Ya tienes cuenta?", "Inicia sesión", "/ingresar"],
  },
} as const;

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const login = mode === "login";
  const t = copy[mode];

  const fields: Field[] = login
    ? [{ name: "email", label: "Correo electrónico", type: "email", placeholder: "nombre@correo.com", autoComplete: "email" }]
    : [
        { name: "name", label: "Tu nombre", type: "text", placeholder: "Patrick", autoComplete: "name" },
        { name: "restaurant", label: "Nombre de tu restaurante", type: "text", placeholder: "Mi restaurante", autoComplete: "organization" },
        { name: "email", label: "Correo electrónico", type: "email", placeholder: "nombre@correo.com", autoComplete: "email" },
      ];

  return (
    // data-chef-area: el chef sigue al cursor en toda la pantalla
    <main data-chef-area className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4e6c9] p-3 sm:p-8">
      {/* Fondo: la cocina del chef, muy difuminada */}
      <Image src="/chef/f051.webp" alt="" fill priority sizes="100vw" className="scale-125 object-cover opacity-80 blur-2xl" />
      <div aria-hidden className="absolute inset-0 bg-[#f4e6c9]/35" />

      <div className="relative grid w-full max-w-[1040px] overflow-hidden rounded-[32px] bg-white p-2.5 shadow-[0_30px_80px_rgba(3,42,31,0.28)] sm:p-3 md:grid-cols-[1.05fr_1fr]">
        {/* Chef */}
        <div className="relative h-64 overflow-hidden rounded-[24px] bg-[#e9d4ad] sm:h-80 md:h-auto md:min-h-[620px]">
          <ChefScrub className="absolute inset-0 [&_img]:object-[50%_15%]" center={0.33} posX={0.46} fade={false} desktopOnly />
          <div aria-hidden className="absolute inset-0 bg-linear-to-t from-[#032a1f]/85 via-[#032a1f]/10 to-transparent" />
          <Link
            href="/"
            className="absolute left-4 top-4 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/80 px-3.5 text-sm font-bold text-[#032a1f] backdrop-blur transition-colors hover:bg-white"
          >
            <ArrowLeft className="size-4" aria-hidden /> Inicio
          </Link>
          <div className="absolute inset-x-5 bottom-4 sm:inset-x-8 sm:bottom-8">
            <p className="font-brand text-[26px] font-extrabold uppercase md:text-[clamp(34px,4.4vw,54px)] leading-[0.95] tracking-[-0.02em] text-white">
              {t.tagline.map((l) => (
                <span key={l} className="mr-2 inline md:mr-0 md:block">{l}</span>
              ))}
            </p>
            <p className="mt-3 hidden items-center gap-1.5 text-[13px] font-semibold text-white/80 md:flex">
              <MousePointer2 className="size-4" aria-hidden /> Mueve el cursor: el chef te mira.
            </p>
          </div>
        </div>

        {/* Formulario */}
        <div className="flex flex-col justify-center px-4 py-8 sm:px-10 md:px-12 lg:px-14">
          <div className="mx-auto w-full max-w-[380px]">
            <div className="flex flex-col items-center text-center">
              <Image src="/brand/costea-symbol.svg" alt="" width={44} height={44} />
              <span className="mt-1 font-brand text-lg font-extrabold text-[#006b4b]">costea</span>
              <h1 className="mt-5 font-brand text-[28px] font-extrabold uppercase leading-tight tracking-[-0.01em] text-[#032a1f] sm:text-[32px]">
                {t.title}
              </h1>
              <p className="mt-2 text-[15px] leading-snug text-[#5b6b65]">{t.sub}</p>
            </div>

            {/* Fase 3 conectará este formulario con Supabase Auth. Por ahora entra en modo demostración. */}
            <form
              className="mt-8 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                router.push("/app");
              }}
            >
              {fields.map((f) => (
                <label key={f.name} className="block text-sm font-bold text-[#12251f]">
                  {f.label}
                  <input name={f.name} type={f.type} required placeholder={f.placeholder} autoComplete={f.autoComplete} className={input} />
                </label>
              ))}

              <div>
                <label htmlFor="password" className="text-sm font-bold text-[#12251f]">Contraseña</label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={show ? "text" : "password"}
                    required
                    minLength={login ? undefined : 8}
                    placeholder={login ? "Tu contraseña" : "Mínimo 8 caracteres"}
                    autoComplete={login ? "current-password" : "new-password"}
                    className={`${input} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute right-1.5 top-[9px] grid size-10 place-items-center rounded-lg text-[#5b6b65] hover:bg-white"
                  >
                    {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
                  </button>
                </div>
              </div>

              {login && (
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 font-semibold text-[#3f524b]">
                    <input type="checkbox" name="remember" className="size-4 accent-[#006b4b]" /> Recordarme
                  </label>
                  <button type="button" className="font-bold text-[#006b4b] hover:underline">¿Olvidaste tu contraseña?</button>
                </div>
              )}

              <button
                type="submit"
                className="mt-2 h-12 w-full rounded-xl bg-[#032a1f] text-[15px] font-extrabold text-white transition-colors hover:bg-[#006b4b] active:scale-[0.99]"
              >
                {t.submit}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[#5b6b65]">
              {t.alt[0]}{" "}
              <Link href={t.alt[2]} className="font-extrabold text-[#032a1f] hover:text-[#006b4b] hover:underline">
                {t.alt[1]}
              </Link>
            </p>
            <p className="mt-6 rounded-xl bg-[#fef3d8] px-4 py-2.5 text-center text-xs text-[#7a5a12]">
              Modo demostración: el acceso real se conecta en la siguiente fase.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

