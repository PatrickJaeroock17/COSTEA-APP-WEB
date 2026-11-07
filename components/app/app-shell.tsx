"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, CalendarDays, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { NavList } from "@/components/app/nav-list";
import { SelectMenu } from "@/components/app/select-menu";
import { SETTINGS_ITEM } from "@/lib/nav";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre",
].map((m) => `${m} 2026`);

/** Fase 5 (Restaurantes/periodos) conectará estos selectores con la base de datos. */
const RESTAURANTS = ["Mi restaurante"];

function UserCard({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href={SETTINGS_ITEM.href}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-2xl bg-[#0b3f2e] p-3 transition-colors hover:bg-[#0f4d38]"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#a9d63a] font-brand text-lg font-extrabold text-[#032a1f]">P</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-white">Patrick</span>
        <span className="block truncate text-xs text-[#9dc0b0]">Configuración y cuenta</span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const [restaurant, setRestaurant] = useState(RESTAURANTS[0]);
  const [month, setMonth] = useState("Noviembre 2026");

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawer]);

  return (
    <div className="min-h-screen bg-[#f6f9f7] text-[#12251f]">
      {/* Menú lateral (escritorio) */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[280px] flex-col bg-[#032a1f] px-4 pb-4 pt-6 lg:flex">
        <Logo variant="dark" className="px-3" />
        <div className="mt-8 flex-1 overflow-y-auto pr-1">
          <NavList />
        </div>
        <UserCard />
      </aside>

      {/* Cajón (móvil) */}
      <div
        className={`fixed inset-0 z-40 lg:hidden ${drawer ? "" : "pointer-events-none"}`}
        aria-hidden={!drawer}
      >
        <div
          onClick={() => setDrawer(false)}
          className={`absolute inset-0 bg-[#032a1f]/60 transition-opacity duration-300 ${drawer ? "opacity-100" : "opacity-0"}`}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-[300px] max-w-[85vw] flex-col bg-[#032a1f] px-4 pb-4 pt-5 transition-transform duration-300 ${drawer ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex items-center justify-between px-3">
            <Logo variant="dark" />
            <button type="button" onClick={() => setDrawer(false)} aria-label="Cerrar menú" className="grid size-11 place-items-center rounded-xl text-white hover:bg-white/10">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="mt-6 flex-1 overflow-y-auto pr-1">
            <NavList onNavigate={() => setDrawer(false)} />
          </div>
          <UserCard onNavigate={() => setDrawer(false)} />
        </aside>
      </div>

      <div className="lg:pl-[280px]">
        <header className="sticky top-0 z-10 flex min-h-16 items-center gap-2 border-b border-[#e2e9e5] bg-white/90 px-3 py-2 backdrop-blur sm:gap-3 sm:px-6 lg:px-8">
          <button type="button" onClick={() => setDrawer(true)} aria-label="Abrir menú" aria-expanded={drawer} className="grid size-11 shrink-0 place-items-center rounded-xl text-[#032a1f] hover:bg-[#f6f9f7] lg:hidden">
            <Menu className="size-6" aria-hidden />
          </button>
          <SelectMenu icon={Building2} label="Restaurante" options={RESTAURANTS} value={restaurant} onChange={setRestaurant} className="min-w-0 flex-1 sm:flex-none" />
          <SelectMenu icon={CalendarDays} label="Mes de trabajo" options={MONTHS} value={month} onChange={setMonth} short={(v) => `${v.slice(0, 3)} ${v.slice(-4)}`} className="min-w-0 flex-1 sm:flex-none" />
          <span className="ml-auto hidden rounded-full bg-[#d2efe1] px-4 py-2 text-sm font-bold text-[#00563d] md:inline-block">
            Vista con datos de ejemplo
          </span>
        </header>
        <main className="px-4 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

