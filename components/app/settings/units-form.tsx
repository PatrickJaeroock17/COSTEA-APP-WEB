"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { FormAlert, SaveButton } from "@/components/app/form";
import { saveUnits, type WorkspaceState } from "@/lib/actions/workspace";
import { UNIT_DIMENSIONS } from "@/lib/restaurants";

export type UnitOption = { code: string; name: string; symbol: string; dimension: string; enabled: boolean };

export function UnitsForm({ units, readOnly }: { units: UnitOption[]; readOnly: boolean }) {
  const [state, action] = useActionState<WorkspaceState, FormData>(saveUnits, {});
  const groups = Object.entries(UNIT_DIMENSIONS)
    .map(([dimension, label]) => ({ label, units: units.filter((u) => u.dimension === dimension) }))
    .filter((g) => g.units.length);

  return (
    <form action={action} className="space-y-6">
      <fieldset disabled={readOnly} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="sr-only">Unidades disponibles</legend>
        {groups.map((g) => (
          <div key={g.label} className="rounded-2xl bg-surface p-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground">{g.label}</p>
            <div className="mt-3 space-y-2">
              {g.units.map((u) => (
                <label key={u.code} className="group flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-white px-3 has-[:checked]:ring-2 has-[:checked]:ring-brand-600/30">
                  <input type="checkbox" name="unit" value={u.code} defaultChecked={u.enabled} className="peer sr-only" />
                  <span className="grid size-5 place-items-center rounded-md border-2 border-line-strong text-white transition-colors peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-600/20">
                    <Check className="size-3.5" strokeWidth={3} aria-hidden />
                  </span>
                  <span className="flex-1 text-sm font-semibold text-ink">{u.name}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">{u.symbol}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </fieldset>
      {!readOnly && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SaveButton>Guardar unidades</SaveButton>
          <FormAlert error={state.error} message={state.message} />
        </div>
      )}
    </form>
  );
}
