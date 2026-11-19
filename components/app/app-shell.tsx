"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Building2, CalendarDays, LogOut, Menu, Plus, Settings, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { NavList } from "@/components/app/nav-list";
import { SelectMenu } from "@/components/app/select-menu";
import { signOut } from "@/lib/actions/auth";
import { selectPeriod, selectRestaurant } from "@/lib/actions/workspace";
import type { CostLevel } from "@/lib/cost-level";
import { SETTINGS_ITEM } from "@/lib/nav";
import { cn, focusRing, focusRingDark } from "@/lib/utils";

export type ShellProps = {
  user: { name: string; email: string };
  restaurants: { id: string; name: string }[];
  restaurantId: string | null;
  periods: { id: number; label: string }[];
  periodId: number | null;
  /** Mostrar la insignia «Cifras de ejemplo» (el mes no tiene plan con cálculo completo). */
  sampleData: boolean;
  /** Nivel de costeo del restaurante y si el usuario puede cambiarlo. */
  costLevel: CostLevel;
  canChangeLevel: boolean;
};

function MenuLink({ href, label, close }: { href: string; label: string; close: () => void }) {
  return (
    <Link href={href} onClick={close} className={cn("flex min-h-10 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-bold text-primary hover:bg-accent", focusRing)}>
      <Plus className="size-4" aria-hidden />
      {label}
    </Link>
  );
}

function UserCard({ user, onNavigate }: { user: ShellProps["user"]; onNavigate?: () => void }) {
  const icon = cn("grid size-11 shrink-0 place-items-center rounded-xl text-sidebar-icon transition-colors hover:bg-white/10 hover:text-white lg:size-9", focusRingDark);
  return (
    <div className="flex items-center gap-1.5 rounded-2xl bg-brand-800 p-2.5 lg:gap-2.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sidebar-primary font-brand text-lg font-extrabold uppercase text-sidebar-primary-foreground">
        {user.name.charAt(0) || "?"}
      </span>
      <span className="ml-1 min-w-0 flex-1 lg:ml-0">
        <span className="block truncate text-sm font-bold text-white">{user.name}</span>
        <span className="block truncate text-xs text-sidebar-icon">{user.email}</span>
      </span>
      <Link href={SETTINGS_ITEM.href} onClick={onNavigate} className={icon} aria-label="Configuración y cuenta" title="Configuración y cuenta">
        <Settings className="size-4.5" aria-hidden />
      </Link>
      <form action={signOut}>
        <button type="submit" className={icon} aria-label="Cerrar sesión" title="Cerrar sesión">
          <LogOut className="size-4.5" aria-hidden />
        </button>
      </form>
    </div>
  );
}
export function AppShell({ children, user, restaurants, restaurantId, periods, periodId, sampleData, costLevel, canChangeLevel }: ShellProps & { children: React.ReactNode }) {
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const [, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingPeriod, setPendingPeriod] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    const opener = menuRef.current;
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    // Al abrir, el foco pasa al botón de cerrar; al cerrar, vuelve al botón que abrió el menú.
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      opener?.focus();
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

  const choosePeriod = (id: number) => {
    setPendingPeriod(id);
    startTransition(async () => {
      await selectPeriod(id);
      router.refresh();
      setPendingPeriod(null);
    });
  };

  const periodOptions = periods.length
    ? periods.map((p) => ({ value: String(p.id), label: p.label }))
    : [{ value: "", label: "Sin mes" }];

  const restaurantOptions = restaurants.length
    ? restaurants.map((r) => ({ value: r.id, label: r.name }))
    : [{ value: "", label: "Sin restaurante" }];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-sidebar flex-col bg-sidebar px-4 pb-4 pt-6 lg:flex print:hidden">
        <Logo variant="dark" className="px-3" />
        <div className="mt-8 flex-1 overflow-y-auto pr-1">
          <NavList level={costLevel} editable={canChangeLevel} />
        </div>
        <UserCard user={user} />
      </aside>

      {/* inert: con el cajón cerrado, su contenido no recibe foco con Tab. */}
      <div className={`fixed inset-0 z-40 lg:hidden ${drawer ? "" : "pointer-events-none"}`} aria-hidden={!drawer} inert={!drawer}>
        <div onClick={() => setDrawer(false)} className={`absolute inset-0 bg-brand-900/60 transition-opacity duration-300 ${drawer ? "opacity-100" : "opacity-0"}`} />
        <aside className={`absolute inset-y-0 left-0 flex w-75 max-w-[85vw] flex-col bg-sidebar px-4 pb-4 pt-5 transition-transform duration-300 ${drawer ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center justify-between px-3">
            <Logo variant="dark" />
            <button ref={closeRef} type="button" onClick={() => setDrawer(false)} aria-label="Cerrar menú" className={cn("grid size-11 place-items-center rounded-xl text-white hover:bg-white/10", focusRingDark)}>
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="mt-6 flex-1 overflow-y-auto pr-1">
            <NavList onNavigate={() => setDrawer(false)} level={costLevel} editable={canChangeLevel} />
          </div>
          <UserCard user={user} onNavigate={() => setDrawer(false)} />
        </aside>
      </div>

      <div className="lg:pl-sidebar print:pl-0">
        <header className="sticky top-0 z-10 print:hidden flex min-h-16 items-center gap-2 border-b border-line bg-card/90 px-3 py-2 backdrop-blur sm:gap-3 sm:px-6 lg:px-8">
          <button ref={menuRef} type="button" onClick={() => setDrawer(true)} aria-label="Abrir menú" aria-expanded={drawer} className={cn("grid size-11 shrink-0 place-items-center rounded-xl text-heading hover:bg-surface lg:hidden", focusRing)}>
            <Menu className="size-6" aria-hidden />
          </button>
          <SelectMenu
            icon={Building2}
            label="Restaurante"
            options={restaurantOptions}
            value={pendingId ?? restaurantId ?? ""}
            onChange={(id) => id && chooseRestaurant(id)}
            footer={(close) => <MenuLink href="/app/configuracion?seccion=restaurantes" label="Nuevo restaurante" close={close} />}
            className="min-w-0 flex-1 sm:flex-none"
          />
          <SelectMenu
            icon={CalendarDays}
            label="Mes de trabajo"
            options={periodOptions}
            value={String(pendingPeriod ?? periodId ?? "")}
            onChange={(id) => id && choosePeriod(Number(id))}
            short={(label) => (label.includes(" ") ? `${label.slice(0, 3)} ${label.slice(-4)}` : label)}
            footer={restaurants.length ? (close) => <MenuLink href="/app/configuracion?seccion=periodos" label="Agregar mes" close={close} /> : undefined}
            className="min-w-0 flex-1 sm:flex-none"
          />
          {sampleData && (
            <span className="ml-auto hidden rounded-full bg-brand-100 px-4 py-2 text-sm font-bold text-brand-700 md:inline-block">
              Cifras de ejemplo
            </span>
          )}
        </header>
        {/* En móvil la insignia no cabe junto a los selectores: va como franja bajo la barra. */}
        {sampleData && <p className="bg-brand-100 px-4 py-1.5 text-center text-xs font-bold text-brand-700 md:hidden print:hidden">Cifras de ejemplo</p>}
        <main className="px-4 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

/** Mientras se lee la sesión. */
export function AppShellSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-sidebar bg-sidebar px-7 pt-7 lg:block">
        <Logo variant="dark" />
      </aside>
      <div className="lg:pl-sidebar">
        <div className="h-16 border-b border-line bg-card" />
        <div className="space-y-4 px-4 py-10 sm:px-6 lg:px-8" aria-busy="true" aria-label="Cargando">
          <div className="h-12 w-64 animate-pulse rounded-2xl bg-line" />
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-3xl bg-card" />)}
          </div>
        </div>
      </div>
    </div>
  );
}