import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { cn, focusRing } from "@/lib/utils";

const link = cn("inline-flex min-h-11 items-center rounded-md transition-colors hover:text-primary sm:min-h-0", focusRing);

export function SiteFooter() {
  return (
    <footer className="bg-cream-100 text-ink-soft">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8">
        <Logo />
        <nav aria-label="Pie de página" className="flex flex-wrap gap-x-6 text-sm font-semibold sm:gap-y-2">
          <a href="#incluye" className={link}>Qué incluye</a>
          <a href="#como-funciona" className={link}>Cómo funciona</a>
          <a href="#planes" className={link}>Planes</a>
          <a href="#preguntas" className={link}>Preguntas</a>
          <Link href="/ingresar" className={link}>Iniciar sesión</Link>
        </nav>
        <p className="text-xs text-muted-foreground">Costos y presupuestos para restaurantes</p>
      </div>
    </footer>
  );
}
