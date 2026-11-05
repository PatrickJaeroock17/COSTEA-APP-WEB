import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "#incluye", label: "Qué incluye" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#planes", label: "Planes" },
  { href: "#preguntas", label: "Preguntas" },
];

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm font-medium text-brand-900 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-brand-600">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/ingresar" className="hidden text-sm font-semibold text-brand-600 hover:underline sm:inline">
            Iniciar sesión
          </Link>
          <Link
            href="/registro"
            className={cn(buttonVariants(), "h-10 rounded-xl bg-brand-600 px-5 text-sm font-semibold hover:bg-brand-700")}
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </header>
  );
}
