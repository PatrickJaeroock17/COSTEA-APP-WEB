"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ClipboardCheck, Loader2, Plus } from "lucide-react";
import { Field, FormAlert, SaveButton } from "@/components/app/form";
import { buttonVariants } from "@/components/ui/button";
import { addPlanLine, type PlanState, reviewPlan, updatePlan } from "@/lib/actions/plan";

export function PlanSettingsForm({ plan }: { plan: { id: number; name: string; price_date: string; no_cif: boolean; no_expenses: boolean } }) {
  const [state, action] = useActionState<PlanState, FormData>(updatePlan, {});
  const v = state.values;
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <input type="hidden" name="planId" value={plan.id} />
      <Field label="Nombre del plan o escenario" name="name" error={e.name}>
        {(p) => <input {...p} name="name" maxLength={180} defaultValue={v?.name ?? plan.name} />}
      </Field>
      <Field label="Fecha de referencia de los precios" name="priceDate" error={e.priceDate} hint="Valida la vigencia de los precios; no los reemplaza.">
        {(p) => <input {...p} type="date" name="priceDate" defaultValue={v?.priceDate ?? plan.price_date} />}
      </Field>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-ink">
        <input type="checkbox" name="noCif" defaultChecked={v ? v.noCif === "on" : plan.no_cif} className="size-5 accent-primary" />
        No hay CIF en este mes
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-ink">
        <input type="checkbox" name="noExpenses" defaultChecked={v ? v.noExpenses === "on" : plan.no_expenses} className="size-5 accent-primary" />
        No hay gastos administrativos, de ventas ni otros
      </label>
      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
        <SaveButton>Guardar plan</SaveButton>
        <FormAlert error={state.error} message={state.message} />
      </div>
    </form>
  );
}

export function AddLineForm({ planId, products, currency }: { planId: number; products: { id: number; name: string; price: string }[]; currency: string }) {
  const [state, action] = useActionState<PlanState, FormData>(addPlanLine, {});
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  if (!products.length) return <p className="text-sm text-muted-foreground">Todos los platos activos ya están en el plan.</p>;
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[1.4fr_1fr_1fr_0.8fr_auto] sm:items-end" noValidate key={state.message}>
      <input type="hidden" name="planId" value={planId} />
      <Field label="Plato" name="productId" error={e.productId}>
        {(p) => (
          <select {...p} name="productId" defaultValue={v.productId ?? ""}>
            <option value="">Elige un plato</option>
            {products.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Porciones del mes" name="quantity" error={e.quantity}>
        {(p) => <input {...p} name="quantity" inputMode="decimal" defaultValue={v.quantity} />}
      </Field>
      <Field label={`Precio con IGV (${currency})`} name="price" error={e.price}>
        {(p) => <input {...p} name="price" inputMode="decimal" defaultValue={v.price} />}
      </Field>
      <Field label="Factor" name="factor" error={e.factor}>
        {(p) => <input {...p} name="factor" inputMode="decimal" defaultValue={v.factor ?? "1"} />}
      </Field>
      <SaveButton>
        <Plus aria-hidden />
        Agregar
      </SaveButton>
      {(state.error || state.message) && (
        <div className="sm:col-span-5">
          <FormAlert error={state.error} message={state.message} />
        </div>
      )}
    </form>
  );
}

function ReviewSubmit({ fresh }: { fresh: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonVariants({ variant: fresh ? "outline" : "default", size: "lg" })}>
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ClipboardCheck aria-hidden />}
      {fresh ? "Volver a revisar" : "Revisar cálculo"}
    </button>
  );
}

/** Guarda la huella del cálculo revisado (legacy: calcular). */
export function ReviewPlan({ planId, fresh }: { planId: number; fresh: boolean }) {
  return (
    <form action={reviewPlan}>
      <input type="hidden" name="planId" value={planId} />
      <ReviewSubmit fresh={fresh} />
    </form>
  );
}
