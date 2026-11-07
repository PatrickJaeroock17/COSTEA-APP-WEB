"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Building2, CalendarDays, LogOut, Menu, Settings, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { NavList } from "@/components/app/nav-list";
import { SelectMenu } from "@/components/app/select-menu";
import { selectRestaurant, signOut } from "@/lib/actions/auth";
import { SETTINGS_ITEM } from "@/lib/nav";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre",
].map((m, i) => ({ value: `2026-${String(i + 1).padStart(2, "0")}`, label: `${m} 2026` }));

export type ShellProps = {
  user: { name: string; email: string };
  restaurants: { id: string; name: string }[];
  restaurantId: string | null;
};

function UserCard({ user, onNavigate }: { user: ShellProps["user"]; onNavigate?: () => void }) {
  const icon = "grid size-9 shrink-0 place-items-center rounded-xl text-[#9dc0b0] transition-colors hover:bg-white/10 hover:text-white";
  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-[#0b3f2e] p-2.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#a9d63a] font-brand text-lg font-extrabold uppercase text-[#032a1f]">
        {user.name.charAt(0) || "?"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-white">{user.name}</span>
        <span className="block truncate text-xs text-[#9dc0b0]">{user.email}</span>
      </span>
      <Link href={SETTINGS_ITEM.href} onClick={onNavigate} className={icon} aria-label="Configuración y cuenta" title="Configuración y cuenta">
        <Settings className="size-[18px]" aria-hidden />
      </Link>
      <form action={signOut}>
        <button type="submit" className={icon} aria-label="Cerrar sesión" title="Cerrar sesión">
          <LogOut className="size-[18px]" aria-hidden />
        </button>
      </form>
    </div>
  );
}
export function AppShell({ children, user, restaurants, restaurantId }: ShellProps & { children: React.ReactNode }) {
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const [month, setMonth] = useState("2026-11");
  const [, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

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

  const chooseRestaurant = (id: string) => {
    setPendingId(id);
    startTransition(async () => {
      await selectRestaurant(id);
      router.refresh();
      setPendingId(null);
    });
  };

  const restaurantOptions = restaurants.length
    ? restaurants.map((r) => ({ value: r.id, label: r.name }))
    : [{ value: "", label: "Sin restaurante" }];

  return (
    <div className="min-h-screen bg-[#f6f9f7] text-[#12251f]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[280px] flex-col bg-[#032a1f] px-4 pb-4 pt-6 lg:flex">
        <Logo variant="dark" className="px-3" />
        <div className="mt-8 flex-1 overflow-y-auto pr-1">
          <NavList />
        </div>
        <UserCard user={user} />
      </aside>

      <div className={`fixed inset-0 z-40 lg:hidden ${drawer ? "" : "pointer-events-none"}`} aria-hidden={!drawer}>
        <div onClick={() => setDrawer(false)} className={`absolute inset-0 bg-[#032a1f]/60 transition-opacity duration-300 ${drawer ? "opacity-100" : "opacity-0"}`} />
        <aside className={`absolute inset-y-0 left-0 flex w-[300px] max-w-[85vw] flex-col bg-[#032a1f] px-4 pb-4 pt-5 transition-transform duration-300 ${drawer ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center justify-between px-3">
            <Logo variant="dark" />
            <button type="button" onClick={() => setDrawer(false)} aria-label="Cerrar menú" className="grid size-11 place-items-center rounded-xl text-white hover:bg-white/10">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="mt-6 flex-1 overflow-y-auto pr-1">
            <NavList onNavigate={() => setDrawer(false)} />
          </div>
          <UserCard user={user} onNavigate={() => setDrawer(false)} />
        </aside>
      </div>

      <div className="lg:pl-[280px]">
        <header className="sticky top-0 z-10 flex min-h-16 items-center gap-2 border-b border-[#e2e9e5] bg-white/90 px-3 py-2 backdrop-blur sm:gap-3 sm:px-6 lg:px-8">
          <button type="button" onClick={() => setDrawer(true)} aria-label="Abrir menú" aria-expanded={drawer} className="grid size-11 shrink-0 place-items-center rounded-xl text-[#032a1f] hover:bg-[#f6f9f7] lg:hidden">
            <Menu className="size-6" aria-hidden />
          </button>
          <SelectMenu
            icon={Building2}
            label="Restaurante"
            options={restaurantOptions}
            value={pendingId ?? restaurantId ?? ""}
            onChange={(id) => id && chooseRestaurant(id)}
            className="min-w-0 flex-1 sm:flex-none"
          />
          <SelectMenu icon={CalendarDays} label="Mes de trabajo" options={MONTHS} value={month} onChange={setMonth} short={(v) => `${v.slice(0, 3)} ${v.slice(-4)}`} className="min-w-0 flex-1 sm:flex-none" />
          <span className="ml-auto hidden rounded-full bg-[#d2efe1] px-4 py-2 text-sm font-bold text-[#00563d] md:inline-block">
            Cifras de ejemplo
          </span>
        </header>
        <main className="px-4 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

/** Mientras se lee la sesión. */
export function AppShellSkeleton() {
  return (
    <div className="min-h-screen bg-[#f6f9f7]">
      <aside className="fixed inset-y-0 left-0 hidden w-[280px] bg-[#032a1f] px-7 pt-7 lg:block">
        <Logo variant="dark" />
      </aside>
      <div className="lg:pl-[280px]">
        <div className="h-16 border-b border-[#e2e9e5] bg-white" />
        <div className="space-y-4 px-4 py-10 sm:px-6 lg:px-8" aria-busy="true" aria-label="Cargando">
          <div className="h-12 w-64 animate-pulse rounded-2xl bg-[#e2e9e5]" />
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-[24px] bg-white" />)}
          </div>
        </div>
      </div>
    </div>
  );
}