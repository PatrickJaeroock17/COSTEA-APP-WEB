"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { setCostLevel } from "@/lib/actions/workspace";
import { COST_LEVELS, type CostLevel } from "@/lib/cost-level";
import { cn, focusRingDark } from "@/lib/utils";

/** Cambia el nivel y refresca la pantalla. Devuelve el estado para mostrar el error en lenguaje claro. */
export function useCostLevelChange() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const change = (level: CostLevel, onDone?: () => void) => {
    setError(null);
    startTransition(async () => {
      const res = await setCostLevel(level);
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
      onDone?.();
    });
  };
  return { change, pending, error };
}

/** Botón del menú lateral oscuro: muestra todos los módulos. */
export function ActivateFullCosting({ onDone }: { onDone?: () => void }) {
  const { change, pending, error } = useCostLevelChange();
  return (
    <div className="mt-3 px-1">
      <button
        type="button"
        onClick={() => change(3, onDone)}
        disabled={pending}
        className={cn(
          "flex min-h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-lime-500 px-3 text-body font-extrabold text-brand-900 transition-colors hover:bg-lime-400 disabled:cursor-wait disabled:opacity-70",
          focusRingDark,
        )}
      >
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Sparkles className="size-5" aria-hidden />}
        Activar todo
      </button>
      <p className="mt-2 text-small text-sidebar-icon">Activa el costeo completo: se muestran todos los módulos. Tus datos no cambian y puedes volver cuando quieras.</p>
      {error && (
        <p role="alert" className="mt-2 text-small font-semibold text-white">
          {error}
        </p>
      )}
    </div>
  );
}

/** Selector de nivel para Configuración: subir o volver a un nivel menor. */
export function LevelPicker({ level, readOnly }: { level: CostLevel; readOnly?: boolean }) {
  const { change, pending, error } = useCostLevelChange();
  const [target, setTarget] = useState<CostLevel | null>(null);
  return (
    <div>
      <ul className="grid gap-3 md:grid-cols-3">
        {COST_LEVELS.map((l) => {
          const on = l.level === level;
          const busy = pending && target === l.level;
          return (
            <li key={l.level}>
              <button
                type="button"
                disabled={readOnly || pending || on}
                aria-pressed={on}
                onClick={() => {
                  setTarget(l.level);
                  change(l.level);
                }}
                className={cn(
                  "flex h-full min-h-32 w-full flex-col items-start gap-2 rounded-2xl border p-5 text-left transition-colors disabled:cursor-default",
                  on ? "border-brand-600 bg-brand-50" : "border-line bg-white hover:bg-surface",
                  !on && (readOnly || pending) && "opacity-70",
                )}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="font-brand text-lg font-extrabold text-heading">
                    {l.level}. {l.name}
                  </span>
                  {on && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3 py-1 text-small font-bold text-white">
                      <Check className="size-4" strokeWidth={2.5} aria-hidden />
                      Tu nivel
                    </span>
                  )}
                  {busy && <Loader2 className="size-5 animate-spin text-primary" aria-hidden />}
                </span>
                <span className="text-body text-ink-soft">{l.text}</span>
                <span className="mt-auto text-small font-bold text-brand-700">{l.includes}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-4 py-3 font-semibold text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}
