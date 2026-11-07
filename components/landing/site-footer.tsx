import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="bg-cream text-[#3f524b]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Logo />
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
          <a href="#incluye" className="hover:text-[#006b4b]">Qué incluye</a>
          <a href="#como-funciona" className="hover:text-[#006b4b]">Cómo funciona</a>
          <a href="#planes" className="hover:text-[#006b4b]">Planes</a>
          <a href="#preguntas" className="hover:text-[#006b4b]">Preguntas</a>
          <Link href="/ingresar" className="hover:text-[#006b4b]">Iniciar sesión</Link>
        </nav>
        <p className="text-xs">costea · Costos y presupuestos para restaurantes</p>
      </div>
    </footer>
  );
}
