"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowRight, Info } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";
import { DEFAULT_FOOD_COST, parseFoodCostTarget, percentText, quickPrice } from "@/lib/quick-price";
import { cn } from "@/lib/utils";

export type QuickDish = {
  id: number;
  name: string;
  category: string | null;
  /** Costo de insumos por porción (texto exacto) o null si la receta no tiene costo todavía. */
  perUnit: string | null;
  /** Hay insumos sin precio y el costo es parcial. */
  pending: boolean;
  /** Precio de carta actual con IGV, si existe. */
  current: string | null;
};

type Money = { currency: string; igvRate: string; igvLabel: string };

/** Objetivo de food cost editable. Se guarda en la dirección (?fc=) para que se conserve al recargar. */
function useTarget(initial: string | undefined) {
  const start = parseFoodCostTarget(initial ?? String(DEFAULT_FOOD_COST));
  const [raw, setRaw] = useState("value" in start ? start.value : String(DEFAULT_FOOD_COST));
  const parsed = parseFoodCostTarget(raw);
  const set = (next: string) => {
    setRaw(next);
    const ok = parseFoodCostTarget(next);
    if ("value" in ok) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("fc", ok.value);
        window.history.replaceState(null, "", url);
      } catch {
        /* sin dirección editable: no pasa nada */
      }
    }
  };
  return { raw, set, parsed };
}

function TargetField({ raw, onChange, error }: { raw: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div>
      <label htmlFor="food-cost-objetivo" className="block text-base font-bold text-ink">
        ¿Qué parte del precio quieres que se vaya en insumos? (%)
      </label>
      <div className="mt-2 flex items-center gap-3">
        <input
          id="food-cost-objetivo"
          inputMode="decimal"
          value={raw}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "food-cost-error" : "food-cost-ayuda"}
          className={cn(fieldClass, "h-14 w-28 text-center text-xl font-bold")}
        />
        <span className="text-xl font-bold text-heading" aria-hidden>
          %
        </span>
      </div>
      {error ? (
        <p id="food-cost-error" role="alert" className="mt-2 text-base font-semibold text-danger-text">
          {error}
        </p>
      ) : (
        <p id="food-cost-ayuda" className="mt-2 max-w-xl text-base text-ink-soft">
          Ejemplo: con 30 %, de cada S/ 100 que cobras sin IGV, S/ 30 se van en insumos. Es el «food cost»; en restaurantes suele estar entre 25 % y 35 %.
        </p>
      )}
    </div>
  );
}

function SoloInsumos() {
  return <span className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-small font-bold text-brand-700">Solo insumos</span>;
}

function Block({ label, children, note }: { label: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div>
      <p className="text-base font-semibold text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
      {note && <p className="mt-1 text-base text-muted-foreground">{note}</p>}
    </div>
  );
}

/** Resultado de un plato: costo por porción, precio sugerido (con IGV como cifra principal) y precio de carta actual. */
function DishResult({ dish, target, money }: { dish: QuickDish; target: string | null; money: Money }) {
  const { currency, igvRate, igvLabel } = money;
  if (!dish.perUnit) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warning-soft px-4 py-3 text-warning-text">
        <p className="flex items-center gap-2 text-base font-semibold">
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          Aún no hay costo: agrega los insumos de la receta con su precio.
        </p>
        <Link href={`/app/platos/${dish.id}`} className={cn(buttonVariants({ variant: "outline" }), "h-auto min-h-12 whitespace-normal px-5 py-2 text-base")}>
          Completar la receta
        </Link>
      </div>
    );
  }
  const q = target ? quickPrice(dish.perUnit, target, igvRate, dish.current) : null;
  return (
    <>
      {dish.pending && (
        <p className="mb-4 flex items-start gap-2 rounded-2xl bg-warning-soft px-4 py-3 text-base font-semibold text-warning-text">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          Falta el precio de algún insumo: el costo puede quedar corto. Complétalo en Insumos.
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-3">
        <Block label="Costo de insumos por porción">
          <p className="font-brand text-2xl font-extrabold tabular-nums text-heading">{formatMoney(dish.perUnit, currency)}</p>
        </Block>
        <Block
          label={`Precio de carta sugerido (con IGV ${igvLabel})`}
          note={q ? `Sin IGV: ${formatMoney(q.net, currency)}` : undefined}
        >
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-brand text-3xl font-extrabold tabular-nums text-primary">{q ? formatMoney(q.gross, currency) : "—"}</span>
            <SoloInsumos />
          </p>
        </Block>
        <Block
          label="Tu precio de carta hoy"
          note={
            dish.current
              ? q?.currentRatio
                ? `Los insumos son el ${percentText(q.currentRatio)} de ese precio sin IGV.`
                : undefined
              : "Aún no lo fijaste. Puedes guardarlo en la ficha del plato."
          }
        >
          <p className="font-brand text-2xl font-extrabold tabular-nums text-heading">{dish.current ? formatMoney(dish.current, currency) : "Sin precio"}</p>
        </Block>
      </div>
    </>
  );
}

/** Lista de platos con su costo rápido. */
export function QuickCosts({ dishes, money, initialTarget }: { dishes: QuickDish[]; money: Money; initialTarget?: string }) {
  const { raw, set, parsed } = useTarget(initialTarget);
  const target = "value" in parsed ? parsed.value : null;
  return (
    <div className="mt-6 space-y-6">
      <section aria-labelledby="objetivo" className="rounded-3xl border border-line bg-card p-5 sm:p-6">
        <h2 id="objetivo" className="sr-only">
          Objetivo de costo de insumos
        </h2>
        <TargetField raw={raw} onChange={set} error={"error" in parsed ? parsed.error : undefined} />
      </section>

      <ul className="space-y-4">
        {dishes.map((d) => (
          <li key={d.id} className="rounded-3xl border border-line bg-card p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-brand text-xl font-extrabold text-heading">
                <Link href={`/app/platos/${d.id}`} className="hover:underline">
                  {d.name}
                </Link>
              </h3>
              {d.category && <span className="text-base text-muted-foreground">{d.category}</span>}
            </div>
            <DishResult dish={d} target={target} money={money} />
          </li>
        ))}
      </ul>

      <p className="flex items-start gap-2 text-base text-muted-foreground">
        <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
        <span>
          Este cálculo usa solo los insumos del plato, con el precio de insumos al día de hoy y sin IGV. No incluye mano de obra ni gastos del local.
        </span>
      </p>
    </div>
  );
}

/** Tarjeta de la ficha de un plato: precio sugerido con el objetivo editable. */
export function QuickPriceCard({ dish, money, initialTarget }: { dish: QuickDish; money: Money; initialTarget?: string }) {
  const { raw, set, parsed } = useTarget(initialTarget);
  const target = "value" in parsed ? parsed.value : null;
  return (
    <section aria-labelledby="precio-sugerido" className="rounded-3xl border border-line bg-card p-5 sm:p-7">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="precio-sugerido" className="font-brand text-xl font-extrabold text-heading">
          Precio sugerido
        </h2>
        <SoloInsumos />
      </div>
      <p className="mt-1 text-base text-ink-soft">Cuánto cobrar para que los insumos no pasen del porcentaje que elijas.</p>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr] lg:items-start">
        <TargetField raw={raw} onChange={set} error={"error" in parsed ? parsed.error : undefined} />
        <DishResult dish={dish} target={target} money={money} />
      </div>
    </section>
  );
}

/** Enlace a subir de nivel, al pie de la vista de costo rápido. */
export function MoreCostingHint() {
  return (
    <section className="rounded-3xl bg-brand-50 p-5 sm:p-6">
      <h2 className="font-brand text-lg font-extrabold text-heading">¿Quieres un costo más completo?</h2>
      <p className="mt-1 max-w-2xl text-base text-ink-soft">
        Puedes sumar el trabajo de tu equipo (nivel «Con mi tiempo») o también los gastos del local, el plan de producción y los reportes (nivel «Costo completo»).
        Tus datos no cambian.
      </p>
      <Link href="/app/configuracion?seccion=nivel" className={cn(buttonVariants({ size: "lg" }), "mt-4 h-auto min-h-12 max-w-full shrink whitespace-normal px-6 py-2 text-center text-base")}>
        Ver niveles de costeo
        <ArrowRight className="size-5" aria-hidden />
      </Link>
    </section>
  );
}
