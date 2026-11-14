"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Reveal, useInView, usePrefersReducedMotion } from "@/components/landing/reveal";
import { priceFromMargin, soles } from "@/lib/costing/price";
import { SectionHeading } from "@/components/landing/section-heading";
import { cn, focusRing } from "@/lib/utils";

const STEP_MS = 5500;

const steps = [
  { title: "Registra tu restaurante", text: "Crea tu cuenta y elige el mes de trabajo." },
  { title: "Carga insumos, recetas y gastos", text: "Tus ingredientes, tus platos, tu personal y tus gastos del mes." },
  { title: "Mira costos y precios", text: "Costea calcula el costo real de cada plato y el precio con tu margen." },
  { title: "Planea y controla", text: "Arma el plan de producción y el presupuesto, y compáralos con tus ventas." },
];

/* ───────────── Vistas previas (valores de ejemplo) ───────────── */

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2">
      <p className="text-caption font-semibold text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-heading">{value}</p>
    </div>
  );
}

function PreviewRestaurant() {
  const months = ["Ago", "Sep", "Oct", "Nov", "Dic"];
  return (
    <div className="space-y-3">
      <p className="text-xs font-extrabold uppercase tracking-label text-muted-foreground">Nuevo restaurante</p>
      <Field label="Nombre" value="Mi cevichería (ejemplo)" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Moneda" value="Soles (PEN)" />
        <Field label="IGV" value="18 %" />
      </div>
      <div>
        <p className="mb-2 text-caption font-semibold text-muted-foreground">Mes de trabajo</p>
        <div className="flex flex-wrap gap-2">
          {months.map((m) => (
            <span
              key={m}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-bold",
                m === "Nov" ? "bg-primary text-primary-foreground" : "bg-card text-ink-soft ring-1 ring-line",
              )}
            >
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PreviewLoad() {
  const items = ["Insumos", "Platos y recetas", "Personal", "Gastos"];
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-extrabold uppercase tracking-label text-muted-foreground">Configuración</p>
        <p className="text-xs font-bold text-heading">4 de 4</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
        <div className="h-full w-full grow-x origin-left rounded-full bg-primary" />
      </div>
      <ul className="mt-4 space-y-2.5">
        {items.map((t, i) => (
          <li
            key={t}
            style={{ animationDelay: `${i * 160}ms` }}
            className="flex items-center gap-3 rounded-xl bg-card px-3 py-2.5 ring-1 ring-line animate-in fade-in slide-in-from-left-3 fill-mode-both duration-500"
          >
            <span className="grid size-6 place-items-center rounded-full bg-lime-500 text-heading">
              <Check className="size-3.5" strokeWidth={3} aria-hidden />
            </span>
            <span className="text-sm font-bold text-heading">{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const DISHES = [
  { name: "Ceviche clásico", cost: "7.52" },
  { name: "Arroz con mariscos", cost: "9.80" },
  { name: "Lomo saltado", cost: "11.40" },
];

function PreviewPrices() {
  return (
    <div>
      <p className="text-xs font-extrabold uppercase tracking-label text-muted-foreground">Costo y precio por plato · margen 35 %</p>
      <ul className="mt-3 space-y-2.5">
        {DISHES.map((d, i) => {
          const p = priceFromMargin(d.cost, "0.35");
          return (
            <li
              key={d.name}
              style={{ animationDelay: `${i * 140}ms` }}
              className="grid grid-cols-[1fr_auto] items-center gap-x-3 rounded-xl bg-card px-3 py-2.5 ring-1 ring-line animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
            >
              <span>
                <span className="block text-sm font-bold text-heading">{d.name}</span>
                <span className="text-xs text-muted-foreground">Costo {soles(d.cost)}</span>
              </span>
              <span className="text-right">
                <span className="block font-brand text-lg font-extrabold tabular-nums text-primary">{soles(p.final)}</span>
                <span className="rounded-full bg-lime-500/50 px-2 py-0.5 text-caption font-bold text-heading">
                  {p.margin ? (p.margin.toNumber() * 100).toFixed(0) : 0} % margen
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const WEEKS = [
  { label: "Sem 1", plan: 60, real: 52 },
  { label: "Sem 2", plan: 70, real: 74 },
  { label: "Sem 3", plan: 75, real: 69 },
  { label: "Sem 4", plan: 85, real: 88 },
];

function PreviewPlan() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-extrabold uppercase tracking-label text-muted-foreground">Presupuesto vs. ventas</p>
        <p className="flex items-center gap-3 text-caption font-semibold text-ink-soft">
          <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-chart-4" /> Presupuesto</span>
          <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-chart-1" /> Ventas</span>
        </p>
      </div>
      <div className="mt-4 flex h-44 items-end justify-between gap-3">
        {WEEKS.map((w, i) => (
          <div key={w.label} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-36 w-full items-end justify-center gap-1.5">
              <div
                style={{ height: `${w.plan}%`, animationDelay: `${i * 120}ms` }}
                className="w-1/2 grow-y origin-bottom rounded-t-lg bg-chart-4"
              />
              <div
                style={{ height: `${w.real}%`, animationDelay: `${i * 120 + 80}ms` }}
                className="w-1/2 grow-y origin-bottom rounded-t-lg bg-chart-1"
              />
            </div>
            <span className="text-caption font-semibold text-muted-foreground">{w.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const previews = [PreviewRestaurant, PreviewLoad, PreviewPrices, PreviewPlan];

/* ───────────── Sección ───────────── */

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ref, inView] = useInView<HTMLDivElement>(false);
  const reduced = usePrefersReducedMotion();
  const auto = inView && !paused && !reduced;

  useEffect(() => {
    if (!auto) return;
    const id = window.setTimeout(() => setActive((a) => (a + 1) % steps.length), STEP_MS);
    return () => window.clearTimeout(id);
  }, [auto, active]);

  const Preview = previews[active];

  return (
    <section id="como-funciona" className="scroll-mt-4 bg-cream-200 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal>
          <SectionHeading eyebrow="En cuatro pasos" title="Cómo funciona" />
        </Reveal>

        <div
          ref={ref}
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.05fr] lg:items-start lg:gap-14"
        >
          <ol className="space-y-3">
            {steps.map((s, i) => {
              const on = i === active;
              return (
                <li key={s.title}>
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    aria-current={on ? "step" : undefined}
                    className={cn(
                      "relative w-full overflow-hidden rounded-3xl p-5 text-left transition-all duration-300 sm:p-6",
                      focusRing,
                      on
                        ? "bg-white shadow-lift"
                        : "bg-white/50 hover:bg-white/80",
                    )}
                  >
                    <span className="flex items-start gap-4">
                      <span
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-full font-brand text-lg font-extrabold transition-colors duration-300",
                          on ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
                        )}
                      >
                        {i + 1}
                      </span>
                      <span>
                        <span className="block font-brand text-xl font-extrabold text-heading">{s.title}</span>
                        <span
                          className={cn(
                            "block overflow-hidden text-sm leading-relaxed text-ink-soft transition-all duration-300",
                            on ? "mt-1.5 max-h-24 opacity-100" : "max-h-0 opacity-0",
                          )}
                        >
                          {s.text}
                        </span>
                      </span>
                    </span>
                    {on && !reduced && (
                      <span
                        key={`${active}-${paused}`}
                        aria-hidden
                        style={{ animationDuration: `${STEP_MS}ms`, animationPlayState: auto ? "running" : "paused" }}
                        className="step-progress absolute inset-x-0 bottom-0 h-1 origin-left bg-lime-500"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="rounded-4xl border border-cream-300/70 bg-white p-4 shadow-soft sm:p-5 lg:sticky lg:top-8">
            <div className="mb-3 flex items-center gap-1.5" aria-hidden>
              <i className="size-2.5 rounded-full bg-cream-300" />
              <i className="size-2.5 rounded-full bg-cream-300" />
              <i className="size-2.5 rounded-full bg-cream-300" />
              <span className="ml-2 text-caption font-semibold text-muted-foreground">Vista de ejemplo</span>
            </div>
            <div key={active} className="min-h-75 rounded-2xl bg-cream-50 p-4 animate-in fade-in slide-in-from-bottom-2 duration-500 sm:p-5">
              <Preview />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

