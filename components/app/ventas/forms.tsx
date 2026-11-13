"use client";

import { createContext, useActionState, useContext, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Trash2 } from "lucide-react";
import { Field, FormAlert, SaveButton } from "@/components/app/form";
import { StockShortage } from "@/components/app/stock-shortage";
import { buttonVariants } from "@/components/ui/button";
import { deleteSale, registerSale, type SaleState } from "@/lib/actions/sales";

/**
 * Un solo espacio de mensajes para la página de ventas: lo actualizan registrar y eliminar, así un
 * mensaje viejo ("Venta guardada…") no queda visible después de eliminar.
 */
const Feedback = createContext<{ feedback: SaleState; setFeedback: (s: SaleState) => void }>({ feedback: {}, setFeedback: () => {} });

export function SalesFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [feedback, setFeedback] = useState<SaleState>({});
  return <Feedback.Provider value={{ feedback, setFeedback }}>{children}</Feedback.Provider>;
}

function SalesFeedback() {
  const { feedback } = useContext(Feedback);
  if (feedback.shortage) return <StockShortage title={feedback.shortage.title} rows={feedback.shortage.rows} />;
  return <FormAlert error={feedback.error} message={feedback.message} />;
}

export function SaleForm({ products, defaultDate, min, max }: { products: { id: number; label: string; priced: boolean }[]; defaultDate: string; min: string; max: string }) {
  const [state, action] = useActionState<SaleState, FormData>(registerSale, {});
  const { feedback, setFeedback } = useContext(Feedback);
  useEffect(() => {
    if (state.error || state.message || state.shortage) setFeedback(state);
  }, [state, setFeedback]);
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[1.6fr_1fr_0.8fr_auto] sm:items-end" noValidate>
      <Field label="Plato vendido" name="productId" error={e.productId}>
        {(p) => (
          <select {...p} name="productId" defaultValue={v.productId ?? ""}>
            <option value="">Elige un plato</option>
            {products.map((x) => (
              <option key={x.id} value={x.id} disabled={!x.priced}>
                {x.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Fecha de venta" name="soldOn" error={e.soldOn}>
        {(p) => <input {...p} type="date" name="soldOn" min={min} max={max} defaultValue={v.soldOn ?? defaultDate} />}
      </Field>
      <Field label="Porciones" name="quantity" error={state.shortage ? undefined : e.quantity}>
        {(p) => <input {...p} name="quantity" inputMode="decimal" defaultValue={v.quantity} placeholder="1" key={state.message} />}
      </Field>
      <SaveButton>Registrar venta</SaveButton>
      {(feedback.error || feedback.message || feedback.shortage) && (
        <div className="sm:col-span-4">
          <SalesFeedback />
        </div>
      )}
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonVariants({ variant: "destructive", size: "sm" })}>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      Sí, eliminar
    </button>
  );
}

/** Eliminar pide confirmación: anula las salidas del kardex y actualiza los resultados. */
export function DeleteSale({ saleId }: { saleId: number }) {
  const [confirm, setConfirm] = useState(false);
  const { setFeedback } = useContext(Feedback);
  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} aria-label="Eliminar venta" className={buttonVariants({ variant: "ghost", size: "icon-sm" })}>
        <Trash2 aria-hidden />
      </button>
    );
  }
  return (
    <form
      action={async (fd) => {
        setFeedback(await deleteSale(fd));
      }}
      className="flex justify-end gap-1"
    >
      <input type="hidden" name="saleId" value={saleId} />
      <Submit />
      <button type="button" onClick={() => setConfirm(false)} className={buttonVariants({ variant: "ghost", size: "sm" })}>
        No
      </button>
    </form>
  );
}
