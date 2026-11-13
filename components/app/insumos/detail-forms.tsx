"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { Field, FormAlert, SaveButton } from "@/components/app/form";
import {
  addConversion,
  addPurchaseCost,
  type MaterialState,
  registerPurchase,
  setMaterialActive,
  updateMaterial,
  updatePrice,
} from "@/lib/actions/materials";
import { cn } from "@/lib/utils";

type Option = { key: string; label: string; factor: string };

function useFormState(action: (prev: MaterialState, fd: FormData) => Promise<MaterialState>) {
  const [state, run] = useActionState<MaterialState, FormData>(action, {});
  return { state, run, v: state.values ?? {}, e: state.fieldErrors ?? {} };
}

function Footer({ state, label }: { state: MaterialState; label: string }) {
  return (
    <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
      <SaveButton>{label}</SaveButton>
      <FormAlert error={state.error} message={state.message} />
    </div>
  );
}

/* ───────────── Compra al kardex ───────────── */

function PurchaseEntryForm({ materialId, options, baseSymbol, defaultDate, token, currency }: ActionsProps) {
  const { state, run, v, e } = useFormState(registerPurchase);
  const [unit, setUnit] = useState(v.purchaseUnit || options[0]?.key || "");
  const factor = options.find((o) => o.key === unit)?.factor;
  return (
    <form action={run} className="grid gap-4 sm:grid-cols-2" noValidate key={state.message}>
      <input type="hidden" name="materialId" value={materialId} />
      <input type="hidden" name="token" value={token} />
      <Field label="Cantidad comprada" name="quantity" error={e.quantity}>
        {(p) => <input {...p} name="quantity" inputMode="decimal" required defaultValue={v.quantity} placeholder="5" />}
      </Field>
      <Field label="Unidad de compra" name="purchaseUnit" error={e.purchaseUnit} hint={factor ? `1 = ${factor} ${baseSymbol}` : undefined}>
        {(p) => (
          <select {...p} name="purchaseUnit" value={unit} onChange={(ev) => setUnit(ev.target.value)}>
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label={`Precio por unidad de compra (${currency}, sin IGV)`} name="unitPrice" error={e.unitPrice}>
        {(p) => <input {...p} name="unitPrice" inputMode="decimal" required defaultValue={v.unitPrice} placeholder="12.00" />}
      </Field>
      <Field label="Fecha" name="movementOn" error={e.movementOn}>
        {(p) => <input {...p} type="date" name="movementOn" required defaultValue={v.movementOn || defaultDate} />}
      </Field>
      <p className="text-sm text-[#5b6b65] sm:col-span-2">Suma stock al kardex y registra el precio como versión nueva desde esa fecha.</p>
      <Footer state={state} label="Registrar compra" />
    </form>
  );
}

/* ───────────── Precio directo ───────────── */

function DirectPriceForm({ materialId, baseSymbol, defaultDate, currency }: ActionsProps) {
  const { state, run, v, e } = useFormState(updatePrice);
  return (
    <form action={run} className="grid gap-4 sm:grid-cols-2" noValidate key={state.message}>
      <input type="hidden" name="materialId" value={materialId} />
      <Field label={`Precio por ${baseSymbol} (${currency}, sin IGV)`} name="unitCost" error={e.unitCost}>
        {(p) => <input {...p} name="unitCost" inputMode="decimal" required defaultValue={v.unitCost} placeholder="12.50" />}
      </Field>
      <Field label="Vigente desde" name="effectiveOn" error={e.effectiveOn}>
        {(p) => <input {...p} type="date" name="effectiveOn" required defaultValue={v.effectiveOn || defaultDate} />}
      </Field>
      <Field label="Proveedor o sustento (opcional)" name="source" error={e.source} className="sm:col-span-2">
        {(p) => <input {...p} name="source" maxLength={500} defaultValue={v.source} placeholder="Cotización Mercado Mayorista" />}
      </Field>
      <Footer state={state} label="Guardar precio" />
    </form>
  );
}

/* ───────────── Costo con comprobante ───────────── */

function PurchaseCostForm({ materialId, options, baseSymbol, defaultDate, currency }: ActionsProps) {
  const { state, run, v, e } = useFormState(addPurchaseCost);
  const [unit, setUnit] = useState(v.purchaseUnit || options[0]?.key || "");
  const factor = options.find((o) => o.key === unit)?.factor;
  const money = (name: string, label: string, hint?: string) => (
    <Field label={`${label} (${currency})`} name={name} error={e[name]} hint={hint}>
      {(p) => <input {...p} name={name} inputMode="decimal" required defaultValue={v[name] ?? "0"} />}
    </Field>
  );
  return (
    <form action={run} className="grid gap-4 sm:grid-cols-2" noValidate key={state.message}>
      <input type="hidden" name="materialId" value={materialId} />
      <Field label="Cantidad comprada" name="quantity" error={e.quantity}>
        {(p) => <input {...p} name="quantity" inputMode="decimal" required defaultValue={v.quantity} placeholder="2" />}
      </Field>
      <Field label="Unidad de compra" name="purchaseUnit" error={e.purchaseUnit} hint={factor ? `1 = ${factor} ${baseSymbol}` : undefined}>
        {(p) => (
          <select {...p} name="purchaseUnit" value={unit} onChange={(ev) => setUnit(ev.target.value)}>
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      {money("netAmount", "Importe neto total", "Después de descuentos, sin IGV.")}
      {money("recoverableTax", "IGV recuperable", "Se guarda aparte: no entra al costo.")}
      {money("nonrecoverableTax", "Impuesto no recuperable")}
      {money("attributableCost", "Otros costos atribuibles", "Flete, estiba, etc.")}
      <Field label="Vigente desde" name="effectiveOn" error={e.effectiveOn}>
        {(p) => <input {...p} type="date" name="effectiveOn" required defaultValue={v.effectiveOn || defaultDate} />}
      </Field>
      <Field label="Comprobante o sustento" name="source" error={e.source}>
        {(p) => <input {...p} name="source" maxLength={500} required defaultValue={v.source} placeholder="Factura F001-123" />}
      </Field>
      <Footer state={state} label="Guardar costo" />
    </form>
  );
}

type ActionsProps = {
  materialId: number;
  options: Option[];
  baseSymbol: string;
  defaultDate: string;
  token: string;
  currency: string;
};

const TABS = [
  { key: "compra", label: "Registrar compra", Form: PurchaseEntryForm },
  { key: "precio", label: "Actualizar precio", Form: DirectPriceForm },
  { key: "comprobante", label: "Costo con comprobante", Form: PurchaseCostForm },
] as const;

/** Acciones de precio y stock del insumo, en pestañas. */
export function MaterialActions(props: ActionsProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("compra");
  const Current = TABS.find((t) => t.key === tab)!.Form;
  return (
    <div>
      <div role="tablist" aria-label="Acciones del insumo" className="-mx-1 flex gap-1 overflow-x-auto px-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "min-h-11 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition-colors",
              tab === t.key ? "bg-[#ecf8f2] text-[#006b4b]" : "text-[#5b6b65] hover:bg-[#f6f9f7]",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-5">
        <Current {...props} />
      </div>
    </div>
  );
}

/* ───────────── Presentaciones ───────────── */

export function ConversionForm({ materialId, baseSymbol }: { materialId: number; baseSymbol: string }) {
  const { state, run, v, e } = useFormState(addConversion);
  return (
    <form action={run} className="grid gap-4 sm:grid-cols-2" noValidate key={state.message}>
      <input type="hidden" name="materialId" value={materialId} />
      <Field label="Presentación" name="label" error={e.label}>
        {(p) => <input {...p} name="label" maxLength={80} required defaultValue={v.label} placeholder="Atado, Bolsa 5 kg…" />}
      </Field>
      <Field label={`Equivale a (${baseSymbol})`} name="factor" error={e.factor}>
        {(p) => <input {...p} name="factor" inputMode="decimal" required defaultValue={v.factor} placeholder="0.25" />}
      </Field>
      <Field label="Sustento" name="evidence" error={e.evidence} hint="Por ejemplo: pesado en cocina el 12/11, promedio de 5 atados." className="sm:col-span-2">
        {(p) => <input {...p} name="evidence" maxLength={500} required defaultValue={v.evidence} />}
      </Field>
      <Footer state={state} label="Agregar presentación" />
    </form>
  );
}

/* ───────────── Datos del insumo ───────────── */

export function MaterialDataForm({
  material,
  categories,
}: {
  material: { id: number; code: string; name: string; variety: string | null; category: string; supplier: string | null; fromCatalog: boolean };
  categories: string[];
}) {
  const { state, run, v, e } = useFormState(updateMaterial);
  const val = (k: "code" | "name" | "variety" | "category" | "supplier") => v[k] ?? material[k] ?? "";
  return (
    <form action={run} className="grid gap-4 sm:grid-cols-2" noValidate>
      <input type="hidden" name="materialId" value={material.id} />
      <Field label="Código" name="code" error={e.code} hint={material.fromCatalog ? "Lo define el catálogo general." : "Tres letras, guion y tres números."}>
        {(p) => <input {...p} name="code" maxLength={7} readOnly={material.fromCatalog} aria-readonly={material.fromCatalog || undefined} defaultValue={val("code")} className={cn(p.className, "font-mono uppercase", material.fromCatalog && "text-[#5b6b65]")} />}
      </Field>
      <Field label="Categoría" name="category" error={e.category}>
        {(p) => (
          <>
            <input {...p} name="category" list="categorias" maxLength={100} defaultValue={val("category")} />
            <datalist id="categorias">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </>
        )}
      </Field>
      <Field label="Nombre" name="name" error={e.name}>
        {(p) => <input {...p} name="name" maxLength={220} defaultValue={val("name")} />}
      </Field>
      <Field label="Variedad (opcional)" name="variety" error={e.variety}>
        {(p) => <input {...p} name="variety" maxLength={100} defaultValue={val("variety")} />}
      </Field>
      <Field label="Proveedor (opcional)" name="supplier" error={e.supplier} className="sm:col-span-2">
        {(p) => <input {...p} name="supplier" maxLength={180} defaultValue={val("supplier")} />}
      </Field>
      <Footer state={state} label="Guardar datos" />
    </form>
  );
}

function StatusSubmit({ active }: { active: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors disabled:opacity-60",
        active ? "text-[#5b6b65] hover:bg-[#f6f9f7]" : "bg-[#ecf8f2] text-[#006b4b] hover:bg-[#d2efe1]",
      )}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : active ? <Archive className="size-4" aria-hidden /> : <ArchiveRestore className="size-4" aria-hidden />}
      {active ? "Archivar insumo" : "Restaurar insumo"}
    </button>
  );
}

/** Archivar oculta el insumo de las listas; su historial y kardex se conservan. */
export function StatusButton({ materialId, active }: { materialId: number; active: boolean }) {
  const [confirm, setConfirm] = useState(false);
  if (active && !confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold text-[#5b6b65] hover:bg-[#f6f9f7]">
        <Archive className="size-4" aria-hidden />
        Archivar insumo
      </button>
    );
  }
  return (
    <form action={setMaterialActive} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="materialId" value={materialId} />
      <input type="hidden" name="state" value={active ? "archived" : "active"} />
      {active && <span className="text-sm text-[#3f524b]">¿Archivar? Se conserva su historial.</span>}
      <StatusSubmit active={active} />
      {active && (
        <button type="button" onClick={() => setConfirm(false)} className="min-h-11 rounded-xl px-3 text-sm font-bold text-[#5b6b65] hover:bg-[#f6f9f7]">
          Cancelar
        </button>
      )}
    </form>
  );
}
