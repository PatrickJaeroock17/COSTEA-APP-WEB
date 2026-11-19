import Link from "next/link";
import { ArrowRight, ChevronDown, CircleCheck, Sparkles } from "lucide-react";
import { FirstResult, type QuickDish } from "@/components/app/costos/quick-costs";
import { FirstPriceForm, PickDishForm, StepHeader } from "@/components/app/empezar/steps";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { DEFAULT_FOOD_COST } from "@/lib/quick-price";
import { cn } from "@/lib/utils";

const card = "rounded-3xl border border-line bg-card p-6 sm:p-8";

export type DishChoice = { id: number; name: string; category: string | null };
type Money = { currency: string; igvRate: string; igvLabel: string };

/** Paso 2: elegir el primer plato (uno de ejemplo, en un clic). */
export function ChooseDishView({ example, others, blocked }: { example: DishChoice | undefined; others: DishChoice[]; blocked: boolean }) {
  return (
      <>
        <StepHeader step={2} />
        <h1 className="font-brand text-3xl font-extrabold tracking-title text-heading sm:text-4xl">Elige tu primer plato</h1>
        <p className="mt-3 text-lg text-ink-soft">Con un plato listo ves tu primer costo en menos de un minuto. Después puedes cambiar lo que quieras.</p>

        {example && !blocked ? (
          <section className={cn(card, "enter-up mt-6 border-brand-600/30 bg-brand-50")} aria-labelledby="ejemplo">
            <p className="flex items-center gap-2 text-base font-bold text-brand-700">
              <Sparkles className="size-5" aria-hidden />
              Plato de ejemplo
            </p>
            <h2 id="ejemplo" className="mt-2 font-brand text-2xl font-extrabold text-heading">
              {example.name}
            </h2>
            <p className="mt-2 text-lg text-ink-soft">Ya trae sus insumos, cantidades y precios. No tienes que escribir nada.</p>
            <div className="mt-6">
              <PickDishForm dishId={example.id} label="Usar este plato de ejemplo" />
            </div>
          </section>
        ) : (
          <p className="mt-6 rounded-2xl bg-warning-soft px-5 py-4 text-lg text-warning-text">
            {blocked ? "Los platos de ejemplo usan precios en soles y tu restaurante trabaja en otra moneda. Crea tu plato desde cero." : "No hay platos de ejemplo disponibles. Crea tu plato desde cero."}
          </p>
        )}

        {others.length > 0 && !blocked && (
          <details className="group mt-6 rounded-3xl border border-line bg-card p-5 sm:p-6">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-lg font-bold text-heading">
              <span className="min-w-0">Ver otros platos ({others.length})</span>
              <ChevronDown className="size-6 shrink-0 text-primary transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <ul className="mt-4 divide-y divide-line">
              {others.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <span className="min-w-0">
                    <span className="block text-lg font-bold text-heading">{d.name}</span>
                    <span className="block text-base text-muted-foreground">{d.category ?? "Otros"}</span>
                  </span>
                  <PickDishForm dishId={d.id} label="Elegir" primary={false} />
                </li>
              ))}
            </ul>
          </details>
        )}

        <p className="mt-8 text-lg text-ink-soft">
          ¿Ya sabes qué plato quieres costear?{" "}
          <Link href="/app/platos" className="font-bold text-primary underline underline-offset-4">
            Créalo desde cero
          </Link>
          .
        </p>
      </>
  );
}

/** Paso 3: el precio de carta. */
export function PriceView({ dishName, perUnit, productId, defaultAmount, suggestedGross, money }: { dishName: string; perUnit: string; productId: number; defaultAmount: string; suggestedGross: string; money: Money }) {
  const { currency, igvLabel } = money;
  return (
    <>
      <StepHeader step={3} />
      <h1 className="font-brand text-3xl font-extrabold tracking-title text-heading sm:text-4xl">¿A qué precio lo vendes?</h1>
      <p className="mt-3 text-lg text-ink-soft">
        <strong className="text-heading">{dishName}</strong> te cuesta <strong className="text-heading">{formatMoney(perUnit, currency)}</strong> por porción solo en insumos.
      </p>
      <section className={cn(card, "mt-6")}>
        <FirstPriceForm productId={productId} defaultAmount={defaultAmount} currency={currency} igvLabel={igvLabel} />
        <p className="mt-5 text-base text-muted-foreground">
          Sugerido: {formatMoney(suggestedGross, currency)} con IGV, para que los insumos sean el {DEFAULT_FOOD_COST} % del precio sin IGV (solo insumos).
        </p>
      </section>
    </>
  );
}

/** Resultado del primer costo. */
export function ResultView({ dish, money }: { dish: QuickDish; money: Money }) {
  return (
      <>
        <div className="mb-8 flex items-start gap-3 rounded-3xl bg-success-soft p-5 sm:p-6" role="status">
          <CircleCheck className="pop-in mt-0.5 size-7 shrink-0 text-primary" aria-hidden />
          <div>
            <h1 className="font-brand text-2xl font-extrabold text-heading sm:text-3xl">¡Listo! Ya calculaste tu primer costo</h1>
            <p className="mt-1 text-lg text-ink-soft">{dish.name}</p>
          </div>
        </div>

        <FirstResult dish={dish} money={money} />

        <div className="enter-up mt-8 flex flex-wrap gap-3" style={{ animationDelay: "0.25s" }}>
          <Link href="/app/costos" className={cn(buttonVariants({ size: "lg" }), "h-auto min-h-14 max-w-full shrink whitespace-normal px-6 py-3 text-center text-lg")}>
            Ver el costo de todos mis platos
            <ArrowRight className="size-5" aria-hidden />
          </Link>
          <Link href="/app/platos?tab=catalogo" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-auto min-h-14 max-w-full shrink whitespace-normal px-6 py-3 text-center text-lg")}>
            Agregar otro plato
          </Link>
        </div>
      </>
  );
}
