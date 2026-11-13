"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, PackagePlus } from "lucide-react";
import { Field, FormAlert, SaveButton } from "@/components/app/form";
import { buttonVariants } from "@/components/ui/button";
import { type InventoryState, importSavedPurchase, registerReceipt, seedOpening } from "@/lib/actions/inventory";

export function ReceiptForm({ materials, defaultDate, defaultMaterial, currency }: { materials: { id: number; label: string }[]; defaultDate: string; defaultMaterial?: number; currency: string }) {
  const [state, action] = useActionState<InventoryState, FormData>(registerReceipt, {});
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_0.9fr_0.9fr]" noValidate key={state.message}>
      <Field label="Insumo" name="materialId" error={e.materialId} className="sm:col-span-2 lg:col-span-1">
        {(p) => (
          <select {...p} name="materialId" defaultValue={v.materialId ?? (defaultMaterial ? String(defaultMaterial) : "")}>
            <option value="">Elige un insumo</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Fecha" name="movementOn" error={e.movementOn}>
        {(p) => <input {...p} type="date" name="movementOn" defaultValue={v.movementOn ?? defaultDate} />}
      </Field>
      <Field label="Cantidad (unidad base)" name="quantity" error={e.quantity}>
        {(p) => <input {...p} name="quantity" inputMode="decimal" defaultValue={v.quantity} placeholder="10" />}
      </Field>
      <Field label={`Costo unitario (${currency})`} name="unitCost" error={e.unitCost} hint="Sin IGV recuperable.">
        {(p) => <input {...p} name="unitCost" inputMode="decimal" defaultValue={v.unitCost} placeholder="8.50" />}
      </Field>
      <Field label="Comprobante o referencia única" name="reference" error={e.reference} className="sm:col-span-2 lg:col-span-3">
        {(p) => <input {...p} name="reference" maxLength={140} defaultValue={v.reference} placeholder="Boleta B001-245 Mercado Mayorista" />}
      </Field>
      <div className="flex items-end">
        <SaveButton className="w-full">
          <PackagePlus aria-hidden />
          Registrar entrada
        </SaveButton>
      </div>
      {(state.error || state.message) && (
        <div className="sm:col-span-2 lg:col-span-4">
          <FormAlert error={state.error} message={state.message} />
        </div>
      )}
    </form>
  );
}

function Pending({ children, variant = "secondary" }: { children: React.ReactNode; variant?: "secondary" | "outline" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonVariants({ variant, size: "sm" })}>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/** Incorporar una compra guardada; el mensaje queda en la fila (la lista se actualiza al terminar). */
export function ImportPurchase({ costVersionId }: { costVersionId: number }) {
  const [result, setResult] = useState<InventoryState>({});
  return (
    <form action={async (fd) => setResult(await importSavedPurchase(fd))} className="flex flex-col items-end gap-1">
      <input type="hidden" name="costVersionId" value={costVersionId} />
      <Pending>Ingresar al kardex</Pending>
      {result.error && <span className="text-xs font-semibold text-danger-text">{result.error}</span>}
    </form>
  );
}

export function SeedOpening() {
  const [result, setResult] = useState<InventoryState>({});
  return (
    <form action={async () => setResult(await seedOpening())} className="space-y-2">
      <Pending variant="outline">Registrar el stock de apertura que falte</Pending>
      <FormAlert error={result.error} message={result.message} />
    </form>
  );
}
