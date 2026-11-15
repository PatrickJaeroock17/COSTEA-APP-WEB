"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Archive, ArchiveRestore, Loader2, Store } from "lucide-react";
import { archiveRestaurant, restoreRestaurant } from "@/lib/actions/workspace";
import { cn } from "@/lib/utils";

export type RestaurantItem = { id: string; name: string; legalName: string; active: boolean; owner: boolean; current: boolean };

function Pending({ children, className }: { children: React.ReactNode; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn("inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors disabled:opacity-60", className)}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/** Archivar pide confirmación: los datos se conservan y se puede restaurar. */
function ArchiveButton({ id, name }: { id: string; name: string }) {
  const [confirm, setConfirm] = useState(false);
  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold text-muted-foreground hover:bg-surface">
        <Archive className="size-4" aria-hidden />
        Archivar
      </button>
    );
  }
  return (
    <form action={archiveRestaurant} className="flex flex-wrap items-center gap-2" role="group" aria-label={`Confirmar archivar ${name}`}>
      <input type="hidden" name="id" value={id} />
      <span className="text-sm text-ink-soft">¿Archivar? Sus datos se conservan.</span>
      <Pending className="bg-danger-text text-white hover:bg-danger-strong">Sí, archivar</Pending>
      <button type="button" onClick={() => setConfirm(false)} className="min-h-10 rounded-xl px-3 text-sm font-bold text-muted-foreground hover:bg-surface">
        Cancelar
      </button>
    </form>
  );
}

export function RestaurantList({ items }: { items: RestaurantItem[] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((r) => (
        <li key={r.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
          <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", r.active ? "bg-brand-50 text-brand-600" : "bg-field text-subtle")}>
            <Store className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className={cn("font-bold", r.active ? "text-heading" : "text-muted-foreground")}>{r.name}</span>
              {r.current && <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-700">En uso</span>}
              {!r.active && <span className="rounded-full bg-field px-2.5 py-0.5 text-xs font-bold text-muted-foreground">Archivado</span>}
            </span>
            {r.name !== r.legalName && <span className="block truncate text-sm text-muted-foreground">{r.legalName}</span>}
          </span>
          {r.owner &&
            (r.active ? (
              <ArchiveButton id={r.id} name={r.name} />
            ) : (
              <form action={restoreRestaurant}>
                <input type="hidden" name="id" value={r.id} />
                <Pending className="text-brand-600 hover:bg-brand-50">
                  <ArchiveRestore className="size-4" aria-hidden />
                  Restaurar
                </Pending>
              </form>
            ))}
        </li>
      ))}
    </ul>
  );
}
