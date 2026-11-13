"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Archive, ArchiveRestore, Loader2, Trash2 } from "lucide-react";
import { Field, FormAlert, SaveButton } from "@/components/app/form";
import {
  deleteProduct,
  type ProductState,
  removeIngredient,
  saveIngredient,
  saveSalePrice,
  scaleRecipe,
  setProductActive,
  updateProduct,
} from "@/lib/actions/products";
import type { UnitRow } from "@/lib/materials";
import { QUANTITY_MODES, consumptionOptions } from "@/lib/recipes";
import { cn } from "@/lib/utils";

export type Choice = {
  id: number;
  name: string;
  baseUnit: string;
  baseSymbol: string;
  prices: { id: number; label: string; effectiveOn: string }[];
  conversions: { id: number; label: string; factor: string }[];
};

export type EditLine = { materialId: number; costVersionId: number; quantity: string; unitKey: string; unitLabel: string; mode: string; percent: string };

function Footer({ state, label }: { state: ProductState; label: string }) {
  return (
    <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
      <SaveButton>{label}</SaveButton>
      <FormAlert error={state.error} message={state.message} />
    </div>
  );
}

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

/** Agregar un insumo a la receta o editar su fila. Cada guardado crea una versión nueva. */
export function IngredientForm({
  productId,
  revision,
  choices,
  units,
  currency,
  line,
  excluded = [],
}: {
  productId: number;
  revision: number;
  choices: Choice[];
  units: UnitRow[];
  currency: string;
  line?: EditLine;
  excluded?: number[];
}) {
  const [state, action] = useActionState<ProductState, FormData>(saveIngredient, {});
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  const available = useMemo(() => choices.filter((c) => c.id === line?.materialId || !excluded.includes(c.id)), [choices, excluded, line]);
  const [materialId, setMaterialId] = useState<number | null>(line?.materialId ?? (v.materialId ? Number(v.materialId) : null));
  const [mode, setMode] = useState(v.mode || line?.mode || "gross");
  const choice = available.find((c) => c.id === materialId);
  const base = units.find((u) => u.code === choice?.baseUnit);
  const options = base && choice ? consumptionOptions(base, units, choice.conversions) : [];
  // Una fila con factor explícito (catálogo) conserva su unidad aunque no sea universal.
  if (line && !options.some((o) => o.key === line.unitKey)) options.unshift({ key: line.unitKey, label: `${line.unitLabel} (de la receta)`, factor: "" });
  const defaultUnit = v.unitKey || line?.unitKey || (base ? (base.dimension === "mass" ? "unit:g" : base.dimension === "volume" ? "unit:ml" : `unit:${base.code}`) : "");

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate key={`${state.message}-${materialId}`}>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="revision" value={revision} />
      {line && <input type="hidden" name="editing" value="1" />}
      {line ? (
        <input type="hidden" name="materialId" value={line.materialId} />
      ) : (
        <Field label="Insumo" name="materialId" error={e.materialId} className="sm:col-span-2" hint={!available.length ? undefined : "¿No está? Créalo o agrégalo del catálogo en Insumos."}>
          {(p) => (
            <select {...p} name="materialId" value={materialId ?? ""} onChange={(ev) => setMaterialId(Number(ev.target.value) || null)}>
              <option value="">Elige un insumo</option>
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.baseSymbol})
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
      {choice && (
        <>
          <Field label="Cantidad usada en todo el lote" name="quantity" error={e.quantity}>
            {(p) => <input {...p} name="quantity" inputMode="decimal" required defaultValue={v.quantity ?? line?.quantity} placeholder="250" />}
          </Field>
          <Field label="Unidad" name="unitKey" error={e.unitKey}>
            {(p) => (
              <select {...p} name="unitKey" defaultValue={defaultUnit}>
                {options.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                    {o.factor && o.key.startsWith("custom:") ? ` · ${o.factor} ${choice.baseSymbol}` : ""}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Cómo está expresada" name="mode" error={e.mode} hint={QUANTITY_MODES.find((m) => m.value === mode)?.hint}>
            {(p) => (
              <select {...p} name="mode" value={mode} onChange={(ev) => setMode(ev.target.value)}>
                {QUANTITY_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={mode === "additional" ? "Adicional (%)" : "Merma (%)"} name="percent" error={e.percent}>
            {(p) => <input {...p} name="percent" inputMode="decimal" readOnly={mode === "gross"} defaultValue={mode === "gross" ? "0" : (v.percent ?? line?.percent ?? "0")} key={mode} />}
          </Field>
          <Field
            label={`Precio usado (${currency} por ${choice.baseSymbol})`}
            name="costVersionId"
            error={e.costVersionId}
            className="sm:col-span-2"
            hint="Si hay kardex, el costo usa el promedio ponderado; este precio queda como respaldo."
          >
            {(p) => (
              <select {...p} name="costVersionId" defaultValue={v.costVersionId || (line ? String(line.costVersionId) : String(choice.prices[0]?.id ?? ""))}>
                {!choice.prices.length && <option value="">Sin precios: regístralo en Insumos</option>}
                {choice.prices.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.label} desde {fmtDate(pr.effectiveOn)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {!choice.prices.length && (
            <p className="text-sm sm:col-span-2">
              <Link href={`/app/insumos/${choice.id}`} className="font-bold text-[#006b4b] underline">
                Registrar un precio para {choice.name}
              </Link>
            </p>
          )}
          <Footer state={state} label={line ? "Guardar cambios" : "Agregar a la receta"} />
        </>
      )}
      {!choice && state.error && <FormAlert error={state.error} />}
    </form>
  );
}

function SmallSubmit({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn("inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold transition-colors disabled:opacity-60", className)}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function RemoveIngredient({ productId, revision, materialId, name }: { productId: number; revision: number; materialId: number; name: string }) {
  const [confirm, setConfirm] = useState(false);
  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-[#9b2c2c] hover:bg-[#fdecec]">
        <Trash2 className="size-4" aria-hidden />
        Quitar
      </button>
    );
  }
  return (
    <form action={removeIngredient} className="flex flex-wrap items-center gap-2" aria-label={`Quitar ${name}`}>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="revision" value={revision} />
      <input type="hidden" name="materialId" value={materialId} />
      <SmallSubmit className="bg-[#9b2c2c] text-white hover:bg-[#7f2424]">Sí, quitar</SmallSubmit>
      <button type="button" onClick={() => setConfirm(false)} className="min-h-10 rounded-xl px-3 text-sm font-bold text-[#5b6b65] hover:bg-[#f6f9f7]">
        Cancelar
      </button>
    </form>
  );
}

export function ScaleForm({ productId, revision, output }: { productId: number; revision: number; output: string }) {
  const [state, action] = useActionState<ProductState, FormData>(scaleRecipe, {});
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="revision" value={revision} />
      <Field label="Nuevo rendimiento (porciones)" name="output" error={state.fieldErrors?.output} hint={`Hoy rinde ${output}. Todas las cantidades se multiplican en la misma proporción.`} className="sm:col-span-2">
        {(p) => <input {...p} name="output" inputMode="decimal" required defaultValue={state.values?.output} placeholder={output} />}
      </Field>
      <Footer state={state} label="Escalar receta" />
    </form>
  );
}

export function ProductDataForm({
  product,
}: {
  product: { id: number; revision: number; name: string; description: string | null; menuCategory: string | null; output: string };
}) {
  const [state, action] = useActionState<ProductState, FormData>(updateProduct, {});
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <input type="hidden" name="productId" value={product.id} />
      <input type="hidden" name="revision" value={product.revision} />
      <Field label="Nombre" name="name" error={e.name} className="sm:col-span-2">
        {(p) => <input {...p} name="name" maxLength={180} defaultValue={v.name ?? product.name} />}
      </Field>
      <Field label="Categoría de la carta" name="menuCategory" error={e.menuCategory}>
        {(p) => <input {...p} name="menuCategory" maxLength={50} defaultValue={v.menuCategory ?? product.menuCategory ?? ""} />}
      </Field>
      <Field label="Rendimiento (porciones)" name="output" error={e.output} hint="Cambiarlo no escala las cantidades.">
        {(p) => <input {...p} name="output" inputMode="decimal" defaultValue={v.output ?? product.output} />}
      </Field>
      <Field label="Descripción" name="description" error={e.description} className="sm:col-span-2">
        {(p) => <textarea {...p} name="description" maxLength={500} rows={3} defaultValue={v.description ?? product.description ?? ""} className={cn(p.className, "h-auto py-3")} />}
      </Field>
      <Footer state={state} label="Guardar datos" />
    </form>
  );
}

export function SalePriceForm({ productId, amount, currency }: { productId: number; amount: string | null; currency: string }) {
  const [state, action] = useActionState<ProductState, FormData>(saveSalePrice, {});
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <input type="hidden" name="productId" value={productId} />
      <Field label={`Precio de carta (${currency}, con IGV 18 %)`} name="amount" error={state.fieldErrors?.amount} className="sm:col-span-2">
        {(p) => <input {...p} name="amount" inputMode="decimal" required defaultValue={state.values?.amount ?? amount ?? ""} placeholder="35.00" />}
      </Field>
      <Footer state={state} label="Guardar precio" />
    </form>
  );
}

export function ProductStatus({ productId, revision, active }: { productId: number; revision: number; active: boolean }) {
  const [state, action] = useActionState<ProductState, FormData>(deleteProduct, {});
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <form action={setProductActive}>
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="state" value={active ? "archived" : "active"} />
          <SmallSubmit className={active ? "text-[#5b6b65] hover:bg-[#f6f9f7]" : "bg-[#ecf8f2] text-[#006b4b] hover:bg-[#d2efe1]"}>
            {active ? <Archive className="size-4" aria-hidden /> : <ArchiveRestore className="size-4" aria-hidden />}
            {active ? "Archivar plato" : "Restaurar plato"}
          </SmallSubmit>
        </form>
        {!confirmDelete && (
          <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-[#9b2c2c] hover:bg-[#fdecec]">
            <Trash2 className="size-4" aria-hidden />
            Eliminar plato
          </button>
        )}
      </div>
      {confirmDelete && (
        <form action={action} className="rounded-xl bg-[#fdecec] p-4">
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="revision" value={revision} />
          <p className="text-sm text-[#7f2424]">Se borran el plato y todas sus versiones. Solo es posible si no tiene ventas, planes ni gastos asignados. No se puede deshacer.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SmallSubmit className="bg-[#9b2c2c] text-white hover:bg-[#7f2424]">Sí, eliminar</SmallSubmit>
            <button type="button" onClick={() => setConfirmDelete(false)} className="min-h-10 rounded-xl px-3 text-sm font-bold text-[#5b6b65] hover:bg-white">
              Cancelar
            </button>
          </div>
          {state.error && (
            <div className="mt-3">
              <FormAlert error={state.error} />
            </div>
          )}
        </form>
      )}
    </div>
  );
}
