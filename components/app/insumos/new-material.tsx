"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus, X } from "lucide-react";
import { Field, FormAlert, SaveButton } from "@/components/app/form";
import { createMaterial, type MaterialState } from "@/lib/actions/materials";

/** Alta de un insumo propio con su precio inicial (legacy: QuickMaterialForm). */
export function NewMaterial({
  categories,
  units,
  defaultDate,
  currency,
}: {
  categories: string[];
  units: { code: string; label: string }[];
  defaultDate: string;
  currency: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action] = useActionState<MaterialState, FormData>(createMaterial, {});
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.error) ref.current?.showModal();
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#006b4b] px-5 text-[15px] font-extrabold text-white transition-colors hover:bg-[#00563d]"
      >
        <Plus className="size-5" aria-hidden />
        Nuevo insumo
      </button>
      <dialog
        ref={ref}
        aria-labelledby="nuevo-insumo-titulo"
        className="m-auto w-[min(640px,calc(100vw-32px))] rounded-[28px] bg-white p-0 text-[#12251f] shadow-[0_30px_80px_rgba(3,42,31,0.25)] backdrop:bg-[#032a1f]/50"
      >
        <form action={action} className="p-6 sm:p-8" noValidate>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="nuevo-insumo-titulo" className="font-brand text-2xl font-extrabold text-[#032a1f]">
                Nuevo insumo propio
              </h2>
              <p className="mt-1 text-sm text-[#5b6b65]">Recibe un código según su categoría. Si está en el catálogo general, agrégalo desde ahí.</p>
            </div>
            <button type="button" onClick={() => ref.current?.close()} aria-label="Cerrar" className="grid size-11 shrink-0 place-items-center rounded-xl text-[#5b6b65] hover:bg-[#f6f9f7]">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" name="name" error={e.name}>
              {(p) => <input {...p} name="name" required maxLength={100} defaultValue={v.name} placeholder="Ají limo" autoFocus />}
            </Field>
            <Field label="Variedad (opcional)" name="variety" error={e.variety}>
              {(p) => <input {...p} name="variety" maxLength={100} defaultValue={v.variety} placeholder="Fresco" />}
            </Field>
            <Field label="Categoría" name="category" error={e.category}>
              {(p) => (
                <select {...p} name="category" required defaultValue={v.category ?? ""}>
                  <option value="" disabled>
                    Elige una categoría
                  </option>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Unidad base del costo" name="unit" error={e.unit} hint="No se puede cambiar después.">
              {(p) => (
                <select {...p} name="unit" required defaultValue={v.unit ?? "kg"}>
                  {units.map((u) => (
                    <option key={u.code} value={u.code}>
                      {u.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={`Precio por unidad base (${currency}, sin IGV)`} name="unitCost" error={e.unitCost}>
              {(p) => <input {...p} name="unitCost" inputMode="decimal" required defaultValue={v.unitCost} placeholder="12.50" />}
            </Field>
            <Field label="Vigente desde" name="effectiveOn" error={e.effectiveOn}>
              {(p) => <input {...p} type="date" name="effectiveOn" required defaultValue={v.effectiveOn || defaultDate} />}
            </Field>
            <Field label="Proveedor (opcional)" name="supplier" error={e.supplier} className="sm:col-span-2">
              {(p) => <input {...p} name="supplier" maxLength={180} defaultValue={v.supplier} placeholder="Mercado Mayorista" />}
            </Field>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <SaveButton>Crear insumo</SaveButton>
            <FormAlert error={state.error} />
          </div>
        </form>
      </dialog>
    </>
  );
}
