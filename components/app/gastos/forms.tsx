"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Plus } from "lucide-react";
import { Dialog } from "@/components/app/dialog";
import { Field, FormAlert, SaveButton } from "@/components/app/form";
import { buttonVariants } from "@/components/ui/button";
import { type ExpenseState, saveConcept, setConceptActive } from "@/lib/actions/expenses";
import { BASES, BEHAVIORS, KINDS } from "@/lib/expenses";
import { cn } from "@/lib/utils";

export type ConceptInitial = {
  id?: number;
  name: string;
  referenceKey: string;
  kind: string;
  amount: string;
  behavior: string;
  basis: string;
  justification: string;
  targets: number[];
  active: boolean;
};

const EMPTY: ConceptInitial = { name: "", referenceKey: "", kind: "cif", amount: "", behavior: "fixed", basis: "equivalent", justification: "", targets: [], active: true };

/** Formulario de gasto (legacy: ConceptForm). Sin destinatarios = se reparte entre todos los platos del plan. */
export function ConceptForm({
  periodId,
  periodLabel,
  currency,
  products,
  initial = EMPTY,
  onState,
  allocationLines = [],
}: {
  periodId: number;
  periodLabel: string;
  currency: string;
  products: { id: number; name: string }[];
  initial?: ConceptInitial;
  onState?: (s: ExpenseState) => void;
  /** Platos de los planes del mes, para completar su reparto (legacy: allocation_line_id). */
  allocationLines?: { id: number; label: string }[];
}) {
  const [state, action] = useActionState<ExpenseState, FormData>(async (prev, fd) => {
    const next = await saveConcept(prev, fd);
    onState?.(next);
    return next;
  }, {});
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  const str = (k: keyof ConceptInitial) => (typeof v[k] === "string" ? (v[k] as string) : String(initial[k] ?? ""));
  const [basis, setBasis] = useState(str("basis"));
  const chosen = new Set((Array.isArray(v.targets) ? v.targets.map(Number) : initial.targets) ?? []);
  const select = (name: string, label: string, options: readonly { value: string; label: string }[], hint?: string, onChange?: (x: string) => void) => (
    <Field label={label} name={name} error={e[name]} hint={hint}>
      {(p) => (
        <select {...p} name={name} defaultValue={str(name as keyof ConceptInitial)} onChange={(ev) => onChange?.(ev.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <input type="hidden" name="periodId" value={periodId} />
      {initial.id && <input type="hidden" name="conceptId" value={initial.id} />}
      <Field label="Concepto" name="name" error={e.name} className="sm:col-span-2">
        {(p) => <input {...p} name="name" maxLength={180} defaultValue={str("name")} placeholder="Luz y agua del local" />}
      </Field>
      {select("kind", "Clasificación", KINDS)}
      <Field label={`Importe mensual (${currency}, sin IGV)`} name="amount" error={e.amount} hint={`Presupuesto de ${periodLabel}.`}>
        {(p) => <input {...p} name="amount" inputMode="decimal" defaultValue={str("amount")} placeholder="800.00" />}
      </Field>
      {select("behavior", "Tipo de gasto", BEHAVIORS, "Los fijos entran al punto de equilibrio de Ventas.")}
      {select("basis", "Base de distribución", BASES, BASES.find((b) => b.value === basis)?.hint, setBasis)}
      <Field label="Comprobante o referencia (opcional)" name="referenceKey" error={e.referenceKey} hint="Evita registrar dos veces el mismo recibo.">
        {(p) => <input {...p} name="referenceKey" maxLength={180} defaultValue={str("referenceKey")} placeholder="Recibo Luz del Sur 0012345" />}
      </Field>
      <Field label="Origen y justificación de la base" name="justification" error={e.justification}>
        {(p) => <input {...p} name="justification" maxLength={500} defaultValue={str("justification")} placeholder="Recibo de octubre; todos los platos usan cocina" />}
      </Field>

      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-bold text-ink">Platos destinatarios</legend>
        <p className="mt-1 text-xs text-muted-foreground">Sin selección, el gasto se reparte entre todos los platos del plan.</p>
        {products.length ? (
          <div className="mt-2 grid max-h-52 gap-1 overflow-y-auto rounded-2xl bg-surface p-2 sm:grid-cols-2">
            {products.map((p) => (
              <label key={p.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-semibold text-ink hover:bg-white">
                <input type="checkbox" name="targets" value={p.id} defaultChecked={chosen.has(p.id)} className="size-5 accent-primary" />
                {p.name}
              </label>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Aún no hay platos.</p>
        )}
        {e.targets && <p className="mt-1.5 text-xs font-semibold text-danger-text">{e.targets}</p>}
      </fieldset>

      {allocationLines.length > 0 && (
        <details className="rounded-2xl bg-surface p-4 sm:col-span-2" open={Boolean(v.allocationLineId)}>
          <summary className="min-h-11 cursor-pointer content-center text-sm font-bold text-ink">Completar el reparto de un plato del plan (opcional)</summary>
          <p className="mt-1 text-xs text-muted-foreground">Vacío conserva el dato del plan. Útil si la base del gasto necesita porciones, venta de referencia o factor.</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="Plato y plan" name="allocationLineId" error={e.allocationLineId} className="sm:col-span-2">
              {(p) => (
                <select {...p} name="allocationLineId" defaultValue={typeof v.allocationLineId === "string" ? v.allocationLineId : ""}>
                  <option value="">Conservar los datos de los planes</option>
                  {allocationLines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Porciones del mes" name="allocationQuantity" error={e.allocationQuantity}>
              {(p) => <input {...p} name="allocationQuantity" inputMode="decimal" defaultValue={typeof v.allocationQuantity === "string" ? v.allocationQuantity : ""} />}
            </Field>
            <Field label={`Venta de referencia sin IGV (${currency})`} name="allocationReferencePrice" error={e.allocationReferencePrice}>
              {(p) => <input {...p} name="allocationReferencePrice" inputMode="decimal" defaultValue={typeof v.allocationReferencePrice === "string" ? v.allocationReferencePrice : ""} />}
            </Field>
            <Field label="Factor equivalente" name="allocationEquivalentFactor" error={e.allocationEquivalentFactor}>
              {(p) => <input {...p} name="allocationEquivalentFactor" inputMode="decimal" defaultValue={typeof v.allocationEquivalentFactor === "string" ? v.allocationEquivalentFactor : ""} />}
            </Field>
          </div>
        </details>
      )}

      <label className="flex min-h-11 items-center gap-3 text-sm font-bold text-ink sm:col-span-2">
        <input type="checkbox" name="active" defaultChecked={typeof v.active === "string" ? v.active === "on" : initial.active} className="size-5 accent-primary" />
        Incluir este gasto en el cálculo
      </label>

      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
        <SaveButton>{initial.id ? "Guardar cambios" : "Registrar gasto"}</SaveButton>
        <FormAlert error={state.error} message={state.message} />
      </div>
    </form>
  );
}

export function NewConcept(props: { periodId: number; periodLabel: string; currency: string; products: { id: number; name: string }[]; kind?: string; allocationLines?: { id: number; label: string }[] }) {
  const [error, setError] = useState<string | undefined>();
  return (
    <Dialog label="Nuevo gasto" icon={Plus} title={`Nuevo gasto de ${props.periodLabel}`} text="Importe presupuestado del mes, sin IGV." open={error}>
      <ConceptForm {...props} initial={{ ...EMPTY, kind: props.kind ?? "cif" }} onState={(s) => setError(s.error)} />
    </Dialog>
  );
}

function ToggleSubmit({ active }: { active: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn(buttonVariants({ variant: active ? "ghost" : "secondary", size: "sm" }))}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {active ? "Excluir del cálculo" : "Volver a incluir"}
    </button>
  );
}

export function ToggleConcept({ conceptId, active }: { conceptId: number; active: boolean }) {
  return (
    <form action={setConceptActive}>
      <input type="hidden" name="conceptId" value={conceptId} />
      <input type="hidden" name="state" value={active ? "inactive" : "active"} />
      <ToggleSubmit active={active} />
    </form>
  );
}
