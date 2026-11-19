"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ChefHat, Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/input";
import { personalizeDish, saveFirstPrice, type ProductState } from "@/lib/actions/products";
import { cn } from "@/lib/utils";

const STEPS = ["Tu restaurante", "Tu primer plato", "Su precio"] as const;

/** Barra de progreso: «Paso N de 3», con el nombre de cada paso. */
export function StepHeader({ step }: { step: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Progreso" className="mb-8">
      <p className="text-base font-bold text-brand-700">
        Paso {step} de {STEPS.length}: <span className="text-heading">{STEPS[step - 1]}</span>
      </p>
      <ol className="mt-3 flex gap-2">
        {STEPS.map((label, i) => {
          const n = i + 1;
          return (
            <li key={label} className="flex-1" aria-current={n === step ? "step" : undefined}>
              <span className={cn("block h-2.5 rounded-full", n < step ? "bg-primary" : n === step ? "bg-lime-500" : "bg-line")} />
              <span className="sr-only">
                {label}
                {n < step ? " (listo)" : n === step ? " (paso actual)" : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Submit({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn(buttonVariants({ size: "lg" }), "h-auto min-h-14 w-full whitespace-normal px-6 py-3 text-center text-lg disabled:cursor-wait sm:w-auto")}>
      {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

/** Trae un plato del catálogo (con sus insumos y precios) y sigue al paso 3. */
export function PickDishForm({ dishId, label, primary = true }: { dishId: number; label: string; primary?: boolean }) {
  const [state, action] = useActionState<ProductState, FormData>(personalizeDish, {});
  return (
    <form action={action}>
      <input type="hidden" name="dishId" value={dishId} />
      <input type="hidden" name="next" value="empezar" />
      {primary ? (
        <Submit icon={<ChefHat className="size-5" aria-hidden />}>{label}</Submit>
      ) : (
        <SecondarySubmit>{label}</SecondarySubmit>
      )}
      {state.error && (
        <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-4 py-3 text-base font-semibold text-danger-text">
          {state.error}
        </p>
      )}
    </form>
  );
}

function SecondarySubmit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn(buttonVariants({ variant: "outline" }), "h-auto min-h-12 whitespace-normal px-5 py-2 text-base disabled:cursor-wait")}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/** Precio de carta del primer plato, con el precio sugerido ya escrito. */
export function FirstPriceForm({ productId, defaultAmount, currency, igvLabel }: { productId: number; defaultAmount: string; currency: string; igvLabel: string }) {
  const [state, action] = useActionState<ProductState, FormData>(saveFirstPrice, {});
  const error = state.fieldErrors?.amount ?? state.error;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      <div>
        <label htmlFor="primer-precio" className="block text-lg font-bold text-ink">
          ¿A qué precio lo vendes? ({currency}, con IGV {igvLabel})
        </label>
        <input
          id="primer-precio"
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={state.values?.amount ?? defaultAmount}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "primer-precio-error" : "primer-precio-ayuda"}
          className={cn(fieldClass, "mt-2 h-16 w-full max-w-xs text-2xl font-bold")}
        />
        {error ? (
          <p id="primer-precio-error" role="alert" className="mt-2 text-base font-semibold text-danger-text">
            Precio de carta: {error}
          </p>
        ) : (
          <p id="primer-precio-ayuda" className="mt-2 text-base text-ink-soft">
            Ya escribimos el precio sugerido. Cámbialo por el que cobras hoy si es distinto.
          </p>
        )}
      </div>
      <Submit>Calcular mi costo</Submit>
    </form>
  );
}
