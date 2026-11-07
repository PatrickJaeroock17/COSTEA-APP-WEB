import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";

const links = [
  { href: "#incluye", label: "Qué incluye" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#planes", label: "Planes" },
  { href: "#preguntas", label: "Preguntas" },
];

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="flex h-[88px] items-center justify-between gap-3 px-5 sm:px-8 md:px-16">
        <Logo />
        <nav className="hidden items-center gap-9 text-[15px] font-semibold text-[#12251f] md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-[#006b4b]">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3 sm:gap-5">
          <Link href="/ingresar" className="hidden text-[15px] font-semibold text-[#006b4b] hover:underline md:inline">
            Iniciar sesión
          </Link>
          <Link
            href="/registro"
            className="rounded-xl bg-[#006b4b] px-4 py-2.5 text-[15px] font-bold text-white transition-colors hover:bg-[#00563d] sm:px-5"
          >
            Crear cuenta
          </Link>
          {/* Menú móvil sin JavaScript */}
          <details className="group relative md:hidden">
            <summary
              aria-label="Abrir menú"
              className="grid size-11 cursor-pointer list-none place-items-center rounded-xl border-[1.5px] border-[#006b4b]/30 bg-white/60 text-[#006b4b] marker:hidden [&::-webkit-details-marker]:hidden"
            >
              <Menu className="size-5" aria-hidden />
            </summary>
            <div className="absolute right-0 top-14 w-56 rounded-2xl bg-white p-2 shadow-[0_12px_30px_rgba(3,42,31,0.18)]">
              {links.map((l) => (
                <a key={l.href} href={l.href} className="block rounded-xl px-4 py-3 text-[15px] font-semibold text-[#12251f] hover:bg-[#f4e6c9]/60">
                  {l.label}
                </a>
              ))}
              <Link href="/ingresar" className="block rounded-xl px-4 py-3 text-[15px] font-semibold text-[#006b4b] hover:bg-[#f4e6c9]/60">
                Iniciar sesión
              </Link>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
