"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, SlidersHorizontal } from "lucide-react";
import { ActivateFullCosting } from "@/components/app/cost-level";
import { type CostLevel, isVisibleAt } from "@/lib/cost-level";
import { NAV_GROUPS } from "@/lib/nav";
import { cn, focusRingDark } from "@/lib/utils";

/**
 * Menú lateral por grupos. Solo muestra los módulos del nivel de costeo del restaurante; el resto queda
 * bajo «Más herramientas» con candado. `onNavigate` cierra el cajón en móvil.
 */
export function NavList({ onNavigate, level = 3, editable = false }: { onNavigate?: () => void; level?: CostLevel; editable?: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

  const groups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => isVisibleAt(i.href, level)) })).filter((g) => g.items.length);
  const locked = NAV_GROUPS.flatMap((g) => g.items).filter((i) => !isVisibleAt(i.href, level));

  return (
    <nav aria-label="Principal" className="space-y-5">
      {groups.map((g) => (
        <div key={g.label ?? "inicio"}>
          {g.label && <p className="mb-2 px-3 text-caption font-bold uppercase tracking-overline text-sidebar-label">{g.label}</p>}
          <ul className="space-y-1">
            {g.items.map(({ href, label, icon: Icon }) => {
              const on = isActive(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 lg:min-h-10 text-body font-semibold transition-colors",
                      focusRingDark,
                      on ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <Icon className={cn("size-5 shrink-0", on ? "text-sidebar-primary" : "text-sidebar-icon")} aria-hidden />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {locked.length > 0 && (
        <div aria-labelledby="mas-herramientas" role="group" className="rounded-2xl bg-brand-800/60 p-2">
          <p id="mas-herramientas" className="mb-1 px-2 pt-1 text-caption font-bold uppercase tracking-overline text-sidebar-label">
            Más herramientas
          </p>
          <ul className="space-y-0.5">
            {locked.map(({ href, label, icon: Icon }) => (
              <li key={href} className="flex min-h-10 items-center gap-3 rounded-xl px-2 text-body font-semibold text-sidebar-icon">
                <Icon className="size-5 shrink-0 opacity-70" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                <Lock className="size-4 shrink-0" aria-hidden />
                <span className="sr-only">(se activa con el costeo completo)</span>
              </li>
            ))}
          </ul>
          {editable ? (
            <ActivateFullCosting onDone={onNavigate} />
          ) : (
            <p className="mt-2 px-2 pb-1 text-small text-sidebar-icon">Pide al dueño o a un editor que active el costeo completo.</p>
          )}
        </div>
      )}

      {level === 3 && (
        <Link
          href="/app/configuracion?seccion=nivel"
          onClick={onNavigate}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-xl px-3 text-small font-semibold text-sidebar-icon transition-colors hover:bg-white/5 hover:text-white",
            focusRingDark,
          )}
        >
          <SlidersHorizontal className="size-4 shrink-0" aria-hidden />
          Mostrar menos herramientas
        </Link>
      )}
    </nav>
  );
}
