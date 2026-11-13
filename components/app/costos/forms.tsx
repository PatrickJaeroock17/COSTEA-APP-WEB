"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Trash2 } from "lucide-react";
import { Field, FormAlert, SaveButton } from "@/components/app/form";
import { buttonVariants } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/input";
import { activatePlan, createPlan, type PlanState, removePlanLine, savePlanLine } from "@/lib/actions/plan";
import type { DishOption } from "@/lib/data/plan";
import { PRICING_MODES } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/* ───────────── Crear el plan del mes ───────────── */

export function CreatePlanForm({
  periodId,
  periodLabel,
  defaultDate,
  dishes,
  currency,
  next,
}: {
  periodId: number;
  periodLabel: string;
  defaultDate: string;
  dishes: DishOption[];
  currency: string;
  next?: "plan";
}) {
  const [state, action] = useActionState<PlanState, FormData>(createPlan, {});
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  // Tras un error el componente conserva su estado, así que la selección del usuario se mantiene.
  const [selected, setSelected] = useState<Set<number>>(() => new Set(dishes.filter((d) => d.quantity && d.price).map((d) => d.productId)));
  const toggle = (id: number) =>
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  const cell = cn(fieldClass, "h-10 text-right tabular-nums");

  return (
    <form action={action} className="space-y-6" noValidate>
      <input type="hidden" name="periodId" value={periodId} />
      {next && <input type="hidden" name="next" value={next} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre del plan" name="name" error={e.name}>
          {(p) => <input {...p} name="name" maxLength={180} defaultValue={v.name ?? `Plan de ${periodLabel}`} />}
        </Field>
        <Field label="Fecha de referencia de los precios" name="priceDate" error={e.priceDate} hint="Los insumos se valoran con el kardex a esa fecha.">
          {(p) => <input {...p} type="date" name="priceDate" defaultValue={v.priceDate ?? defaultDate} />}
        </Field>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-extrabold tracking-[0.06em] text-muted-foreground uppercase">
              <th className="px-4 py-3">Plato</th>
              <th className="px-4 py-3 text-right">Porciones del mes</th>
              <th className="px-4 py-3 text-right">Precio con IGV ({currency})</th>
              <th className="px-4 py-3 text-right">Factor equivalente</th>
            </tr>
          </thead>
          <tbody>
            {dishes.map((d) => {
              const on = selected.has(d.productId);
              return (
                <tr key={d.productId} className={cn("border-b border-line-soft last:border-0", !on && "text-muted-foreground")}>
                  <td className="px-4 py-2">
                    <label className="flex min-h-11 cursor-pointer items-center gap-3">
                      <input type="checkbox" name="dishIds" value={d.productId} checked={on} onChange={() => toggle(d.productId)} className="size-5 accent-primary" />
                      <span>
                        <span className="block font-bold text-heading">{d.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          Versión {d.recipeNumber} · {d.origin}
                        </span>
                      </span>
                    </label>
                  </td>
                  <td className="px-4 py-2">
                    <input aria-label={`Porciones de ${d.name}`} name={`quantity_${d.productId}`} inputMode="decimal" defaultValue={v[`quantity_${d.productId}`] ?? d.quantity} disabled={!on} className={cell} placeholder="0" />
                  </td>
                  <td className="px-4 py-2">
                    <input aria-label={`Precio de ${d.name}`} name={`price_${d.productId}`} inputMode="decimal" defaultValue={v[`price_${d.productId}`] ?? d.price} disabled={!on} className={cell} placeholder="0.00" />
                  </td>
                  <td className="px-4 py-2">
                    <input aria-label={`Factor de ${d.name}`} name={`factor_${d.productId}`} inputMode="decimal" defaultValue={v[`factor_${d.productId}`] ?? d.factor} disabled={!on} className={cell} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 text-sm">
        <label className="flex min-h-11 items-center gap-3 font-semibold text-ink">
          <input type="checkbox" name="noCif" defaultChecked={v.noCif === "on"} className="size-5 accent-primary" />
          No hay CIF en este mes
        </label>
        <label className="flex min-h-11 items-center gap-3 font-semibold text-ink">
          <input type="checkbox" name="noExpenses" defaultChecked={v.noExpenses === "on"} className="size-5 accent-primary" />
          No hay gastos administrativos, de ventas ni otros
        </label>
        <label className="flex min-h-11 items-center gap-3 font-semibold text-ink">
          <input type="checkbox" name="assumption" defaultChecked={v.assumption === "on"} aria-invalid={e.assumption ? true : undefined} className="size-5 accent-primary" />
          Confirmo producción igual a ventas, sin inventarios ni productos en proceso
        </label>
        {e.assumption && <p className="text-xs font-semibold text-danger-text">{e.assumption}</p>}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SaveButton>Crear plan</SaveButton>
        <FormAlert error={state.error} />
      </div>
    </form>
  );
}

/* ───────────── Línea del plan ───────────── */

export function PlanLineForm({
  planId,
  productId,
  initial,
  currency,
  outdated,
}: {
  planId: number;
  productId: number;
  initial: Record<string, string>;
  currency: string;
  outdated: { current: number; latest: number } | null;
}) {
  const [state, action] = useActionState<PlanState, FormData>(savePlanLine, {});
  const v = { ...initial, ...(state.values ?? {}) };
  const e = state.fieldErrors ?? {};
  const [mode, setMode] = useState(v.pricingMode);
  const info = PRICING_MODES.find((m) => m.value === mode);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="productId" value={productId} />
      <Field label="Modalidad de precio" name="pricingMode" error={e.pricingMode} hint={info?.hint}>
        {(p) => (
          <select {...p} name="pricingMode" value={mode} onChange={(ev) => setMode(ev.target.value)}>
            {PRICING_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label={mode === "manual" ? `${info?.field} (${currency})` : (info?.field ?? "Valor")} name="pricingValue" error={e.pricingValue}>
        {(p) => <input {...p} name="pricingValue" inputMode="decimal" defaultValue={v.pricingValue} key={mode} />}
      </Field>
      <Field label={`Precio adoptado con IGV (${currency}, opcional)`} name="adoptedPrice" error={e.adoptedPrice} hint="Reemplaza al sugerido; se redondea a céntimos.">
        {(p) => <input {...p} name="adoptedPrice" inputMode="decimal" defaultValue={v.adoptedPrice} placeholder="—" />}
      </Field>
      <Field label="Porciones del mes" name="quantity" error={e.quantity} hint="Producción igual a ventas.">
        {(p) => <input {...p} name="quantity" inputMode="decimal" defaultValue={v.quantity} />}
      </Field>
      <Field label={`Venta de referencia sin IGV (${currency})`} name="referencePrice" error={e.referencePrice} hint="Solo para repartir gastos por ventas.">
        {(p) => <input {...p} name="referencePrice" inputMode="decimal" defaultValue={v.referencePrice} />}
      </Field>
      <Field label="Factor de unidades equivalentes" name="equivalentFactor" error={e.equivalentFactor} hint="1 solo si el plato es comparable con los demás.">
        {(p) => <input {...p} name="equivalentFactor" inputMode="decimal" defaultValue={v.equivalentFactor} />}
      </Field>
      {outdated && (
        <label className="flex min-h-11 items-center gap-3 rounded-xl bg-warning-soft px-4 text-sm font-semibold text-warning-text sm:col-span-2">
          <input type="checkbox" name="useLatest" className="size-5 accent-primary" />
          Usar la versión vigente de la receta ({outdated.latest}); el plan usa la versión {outdated.current}.
        </label>
      )}
      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
        <SaveButton>Guardar y recalcular</SaveButton>
        <FormAlert error={state.error} message={state.message} />
      </div>
    </form>
  );
}

function Pending({ children, variant }: { children: React.ReactNode; variant: "destructive" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonVariants({ variant, size: "sm" })}>
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : variant === "destructive" ? <Trash2 aria-hidden /> : null}
      {children}
    </button>
  );
}

export function RemoveLine({ lineId, back }: { lineId: number; back: string }) {
  const [confirm, setConfirm] = useState(false);
  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <Trash2 aria-hidden />
        Quitar del plan
      </button>
    );
  }
  return (
    <form action={removePlanLine} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="lineId" value={lineId} />
      <input type="hidden" name="back" value={back} />
      <Pending variant="destructive">Sí, quitar</Pending>
      <button type="button" onClick={() => setConfirm(false)} className={buttonVariants({ variant: "ghost", size: "sm" })}>
        Cancelar
      </button>
    </form>
  );
}

export function ActivatePlan({ planId }: { planId: number }) {
  return (
    <form action={activatePlan}>
      <input type="hidden" name="planId" value={planId} />
      <Pending variant="secondary">Usar este plan</Pending>
    </form>
  );
}
