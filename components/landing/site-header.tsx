import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn, focusRing } from "@/lib/utils";

const links = [
  { href: "#incluye", label: "Qué incluye" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#planes", label: "Planes" },
  { href: "#preguntas", label: "Preguntas" },
];

const menuItem = cn("flex min-h-11 items-center rounded-xl px-4 text-body hover:bg-cream-200/60", focusRing);

/** Cabecera de la portada: va dentro del escenario del hero para quedar anclada con el chef en móvil. */
export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="flex h-14 items-center justify-between gap-2 pl-5 pr-3 pt-3 md:h-29 md:gap-3 md:px-16 md:pt-6">
        <Logo />
        <nav aria-label="Secciones" className="hidden items-center gap-9 text-body font-semibold text-ink md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className={cn("rounded-md transition-colors hover:text-primary", focusRing)}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1 md:gap-3">
          <Link href="/ingresar" className={cn(buttonVariants({ variant: "outline", shape: "pill" }), "h-11 text-sm font-bold")}>
            Iniciar sesión
          </Link>
          <Link href="/registro" className={cn(buttonVariants({ shape: "pill" }), "hidden h-11 px-5 font-bold md:inline-flex")}>
            Crear cuenta
          </Link>
          {/* Menú móvil sin JavaScript */}
          <details className="group relative md:hidden">
            <summary
              aria-label="Abrir menú"
              className={cn("grid size-11 cursor-pointer list-none place-items-center rounded-xl text-heading marker:hidden [&::-webkit-details-marker]:hidden", focusRing)}
            >
              <Menu className="size-6" strokeWidth={2} aria-hidden />
            </summary>
            <div className="absolute right-0 top-12 w-56 rounded-2xl bg-popover p-1.5 shadow-lift">
              {links.map((l) => (
                <a key={l.href} href={l.href} className={cn(menuItem, "font-semibold text-ink")}>
                  {l.label}
                </a>
              ))}
              <Link href="/registro" className={cn(menuItem, "font-bold text-primary")}>
                Crear cuenta
              </Link>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
