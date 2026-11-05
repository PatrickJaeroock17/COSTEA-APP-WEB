import Link from "next/link";
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
      <div className="flex h-[88px] items-center justify-between px-5 sm:px-8 md:px-16">
        <Logo />
        <nav className="hidden items-center gap-9 text-[15px] font-semibold text-[#12251f] md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-[#006b4b]">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3 sm:gap-5">
          <Link href="/ingresar" className="hidden text-[15px] font-semibold text-[#006b4b] hover:underline sm:inline">
            Iniciar sesión
          </Link>
          <Link
            href="/registro"
            className="rounded-xl bg-[#006b4b] px-5 py-2.5 text-[15px] font-bold text-white transition-colors hover:bg-[#00563d]"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </header>
  );
}
