"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check, ChefHat, Loader2, Plus } from "lucide-react";
import { Dialog } from "@/components/app/dialog";
import { Field, FormAlert, SaveButton } from "@/components/app/form";
import { createProduct, personalizeDish, type ProductState, saveSalePrice } from "@/lib/actions/products";
import { inputClass } from "@/components/auth/fields";
import { cn } from "@/lib/utils";

/* ───────────── Nuevo plato propio ───────────── */

export function NewProduct({ categories }: { categories: string[] }) {
  const [state, action] = useActionState<ProductState, FormData>(createProduct, {});
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  return (
    <Dialog label="Nuevo plato" icon={Plus} title="Nuevo plato propio" text="Después agregas sus insumos y cantidades." open={state.error}>
      <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Nombre del plato" name="name" error={e.name} className="sm:col-span-2">
          {(p) => <input {...p} name="name" required maxLength={180} defaultValue={v.name} placeholder="Ceviche de la casa" autoFocus />}
        </Field>
        <Field label="Categoría de la carta (opcional)" name="menuCategory" error={e.menuCategory}>
          {(p) => (
            <>
              <input {...p} name="menuCategory" list="cats-carta" maxLength={50} defaultValue={v.menuCategory} placeholder="Ceviches y tiraditos" />
              <datalist id="cats-carta">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Rendimiento (porciones por lote)" name="output" error={e.output} hint="Para cuántas porciones son las cantidades de la receta.">
          {(p) => <input {...p} name="output" inputMode="decimal" required defaultValue={v.output ?? "1"} />}
        </Field>
        <Field label="Descripción (opcional)" name="description" error={e.description} className="sm:col-span-2">
          {(p) => <textarea {...p} name="description" maxLength={500} rows={3} defaultValue={v.description} className={cn(p.className, "h-auto py-3")} />}
        </Field>
        <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
          <SaveButton>Crear plato</SaveButton>
          <FormAlert error={state.error} />
        </div>
      </form>
    </Dialog>
  );
}

/* ───────────── Catálogo de platos ───────────── */

export type CatalogDishCard = { id: number; name: string; description: string | null; portions: string; category: string | null; ingredients: number; mine: number | null };

function BringButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#006b4b] px-4 text-sm font-extrabold text-white hover:bg-[#00563d] disabled:opacity-60">
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ChefHat className="size-4" aria-hidden />}
      Traer a mi carta
    </button>
  );
}

export function CatalogDishes({ dishes, canAdd, blockedReason }: { dishes: CatalogDishCard[]; canAdd: boolean; blockedReason?: string }) {
  const [state, action] = useActionState<ProductState, FormData>(personalizeDish, {});
  const failed = state.values?.dishId ? Number(state.values.dishId) : null;
  const groups = [...new Set(dishes.map((d) => d.category ?? "Otros"))];
  return (
    <div className="space-y-8">
      <p className="text-[#3f524b]">
        Recetas estándar de cevichería con cantidades, mermas y equivalencias. Al traer un plato se copian sus insumos con el precio del catálogo y se comprueba que el
        inventario alcance para un lote.
      </p>
      {blockedReason && <p className="rounded-xl bg-[#fff6e5] px-4 py-3 text-sm text-[#7a4b00]">{blockedReason}</p>}
      {groups.map((group) => (
        <section key={group}>
          <h2 className="font-brand text-lg font-extrabold text-[#032a1f]">{group}</h2>
          <ul className="mt-3 grid gap-4 md:grid-cols-2">
            {dishes
              .filter((d) => (d.category ?? "Otros") === group)
              .map((d) => (
                <li key={d.id} className="flex flex-col rounded-[24px] border border-[#e2e9e5] bg-white p-5">
                  <p className="font-bold text-[#032a1f]">{d.name}</p>
                  {d.description && <p className="mt-1 line-clamp-3 text-sm text-[#5b6b65]">{d.description}</p>}
                  <p className="mt-3 text-xs font-semibold text-[#5b6b65]">
                    {d.ingredients} insumos · rinde {d.portions} {d.portions === "1" ? "porción" : "porciones"}
                  </p>
                  {failed === d.id && state.error && (
                    <div className="mt-3">
                      <FormAlert error={state.error} />
                    </div>
                  )}
                  <div className="mt-4 flex-1" />
                  {d.mine ? (
                    <Link href={`/app/platos/${d.mine}`} className="inline-flex min-h-11 w-max items-center gap-2 rounded-xl bg-[#ecf8f2] px-4 text-sm font-bold text-[#006b4b]">
                      <Check className="size-4" aria-hidden />
                      Ya está en tu carta
                    </Link>
                  ) : canAdd ? (
                    <form action={action}>
                      <input type="hidden" name="dishId" value={d.id} />
                      <BringButton />
                    </form>
                  ) : null}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* ───────────── Precio de carta en línea ───────────── */

export function PriceCell({ productId, amount, currency, editable }: { productId: number; amount: string | null; currency: string; editable: boolean }) {
  const [state, action] = useActionState<ProductState, FormData>(saveSalePrice, {});
  if (!editable) return <span className="tabular-nums">{amount ?? "—"}</span>;
  return (
    <form action={action} className="flex flex-wrap items-start justify-end gap-2">
      <input type="hidden" name="productId" value={productId} />
      <label className="w-28">
        <span className="sr-only">Precio con IGV ({currency})</span>
        <input
          name="amount"
          inputMode="decimal"
          defaultValue={state.values?.amount ?? amount ?? ""}
          placeholder="0.00"
          aria-invalid={state.error ? true : undefined}
          className={cn(inputClass, "mt-0 h-10 text-right tabular-nums", state.error && "border-[#c53030]")}
        />
      </label>
      <SaveButton className="min-h-10 px-3 text-sm">Guardar</SaveButton>
      {state.error && <p role="alert" className="basis-full text-right text-xs font-semibold text-[#9b2c2c]">{state.error}</p>}
      {state.message && <p role="status" className="basis-full text-right text-xs font-semibold text-[#00563d]">Guardado</p>}
    </form>
  );
}
