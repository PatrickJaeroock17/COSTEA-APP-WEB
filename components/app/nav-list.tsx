"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** Menú lateral por grupos. `onNavigate` cierra el cajón en móvil. */
export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

  return (
    <nav aria-label="Principal" className="space-y-5">
      {NAV_GROUPS.map((g) => (
        <div key={g.label ?? "inicio"}>
          {g.label && (
            <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7fa393]">{g.label}</p>
          )}
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
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 lg:min-h-10 text-[15px] font-semibold transition-colors",
                      on ? "bg-[#0f4d38] text-white" : "text-[#cfe3da] hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <Icon className={cn("size-5 shrink-0", on ? "text-[#a9d63a]" : "text-[#9dc0b0]")} aria-hidden />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
