import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="bg-brand-900 text-brand-200">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 border-t border-white/10 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Logo variant="dark" />
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <a href="#incluye" className="hover:text-white">Qué incluye</a>
          <a href="#como-funciona" className="hover:text-white">Cómo funciona</a>
          <a href="#planes" className="hover:text-white">Planes</a>
          <a href="#preguntas" className="hover:text-white">Preguntas</a>
          <Link href="/ingresar" className="hover:text-white">Iniciar sesión</Link>
        </nav>
        <p className="text-xs">costea · Costos y presupuestos para restaurantes</p>
      </div>
    </footer>
  );
}

