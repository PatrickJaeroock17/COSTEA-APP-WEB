import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";

const links = [
  { href: "#incluye", label: "Qué incluye" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#planes", label: "Planes" },
  { href: "#preguntas", label: "Preguntas" },
];

/** Cabecera de la portada: va dentro del escenario del hero para quedar anclada con el chef en móvil. */
export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="flex h-14 items-center justify-between gap-2 pl-5 pr-3 pt-3 md:h-[116px] md:gap-3 md:px-16 md:pt-6">
        <Logo />
        <nav className="hidden items-center gap-9 text-[15px] font-semibold text-[#12251f] md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-[#006b4b]">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1 md:gap-3">
          <Link
            href="/ingresar"
            className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-[#006b4b] bg-white/55 px-4 text-sm font-bold text-[#006b4b] transition-colors hover:bg-white/80"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/registro"
            className="hidden min-h-11 items-center rounded-full bg-primary px-5 text-[15px] font-bold text-primary-foreground transition-colors hover:bg-brand-700 md:inline-flex"
          >
            Crear cuenta
          </Link>
          {/* Menú móvil sin JavaScript */}
          <details className="group relative md:hidden">
            <summary
              aria-label="Abrir menú"
              className="grid size-11 cursor-pointer list-none place-items-center text-[#032a1f] marker:hidden [&::-webkit-details-marker]:hidden"
            >
              <Menu className="size-6" strokeWidth={2} aria-hidden />
            </summary>
            <div className="absolute right-0 top-12 w-56 rounded-2xl bg-white p-2 shadow-[0_12px_30px_rgba(3,42,31,0.18)]">
              {links.map((l) => (
                <a key={l.href} href={l.href} className="block rounded-xl px-4 py-3 text-[15px] font-semibold text-[#12251f] hover:bg-[#f4e6c9]/60">
                  {l.label}
                </a>
              ))}
              <Link href="/registro" className="block rounded-xl px-4 py-3 text-[15px] font-bold text-[#006b4b] hover:bg-[#f4e6c9]/60">
                Crear cuenta
              </Link>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

