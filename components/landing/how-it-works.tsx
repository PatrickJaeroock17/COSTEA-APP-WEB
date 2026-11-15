"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check } from "lucide-react";
import { useInView, usePrefersReducedMotion } from "@/components/landing/reveal";
import { DotGrid } from "@/components/landing/decor";
import { card, container, section } from "@/components/landing/styles";
import { Reveal } from "@/components/motion/reveal";
import { priceFromMargin, soles } from "@/lib/costing/price";
import { SectionHeading } from "@/components/landing/section-heading";
import { cn, focusRing } from "@/lib/utils";
import fotoRestaurante from "@/public/media/paso-1-restaurante.jpg";
import fotoInsumos from "@/public/media/paso-2-insumos.jpg";
import fotoPlato from "@/public/media/paso-3-plato.jpg";
import fotoPlan from "@/public/media/paso-4-planificacion.jpg";

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
          <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-brand-200" /> Presupuesto</span>
          <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-chart-1" /> Ventas</span>
        </p>
      </div>
      <div className="mt-4 flex h-44 items-end justify-between gap-3">
        {WEEKS.map((w, i) => (
          <div key={w.label} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-36 w-full items-end justify-center gap-1.5">
              <div
                style={{ height: `${w.plan}%`, animationDelay: `${i * 120}ms` }}
                className="w-1/2 grow-y origin-bottom rounded-t-lg bg-brand-200"
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

/** Una foto real por paso (ilustrativas, de stock: public/media/CREDITOS.md). */
const photos = [
  { src: fotoRestaurante, alt: "Salón de un restaurante con mesas de madera listas para el servicio" },
  { src: fotoInsumos, alt: "Pescados, langostinos y limón frescos sobre hielo" },
  { src: fotoPlato, alt: "Ceviche con cancha, choclo y camote servido en un plato azul" },
  { src: fotoPlan, alt: "Manos que hacen cuentas con una calculadora sobre un cuaderno" },
];

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
    <section id="como-funciona" className={section}>
      <DotGrid />
      <div className={cn(container, "relative")}>
        <Reveal>
          <SectionHeading eyebrow="En cuatro pasos" title="Cómo" accent="funciona" />
        </Reveal>

        <div
          ref={ref}
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.05fr] lg:items-start lg:gap-10"
        >
          <ol className="space-y-2.5">
            {steps.map((s, i) => {
              const on = i === active;
              const done = i < active;
              return (
                <li key={s.title} className="relative">
                  {/* Tramo que une este paso con el siguiente: se llena de verde al completarlo */}
                  {i < steps.length - 1 && (
                    <span aria-hidden className="pointer-events-none absolute left-[2.6875rem] top-[4.0625rem] -bottom-[1.9375rem] z-10 w-0.5 -translate-x-1/2 overflow-hidden rounded-full bg-line">
                      <span className={cn("block size-full origin-top bg-primary transition-transform duration-500 ease-out", done ? "scale-y-100" : "scale-y-0")} />
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    aria-current={on ? "step" : undefined}
                    className={cn(
                      "relative w-full overflow-hidden rounded-3xl border p-5 text-left transition-[background-color,border-color,box-shadow] duration-300",
                      focusRing,
                      on ? "border-line bg-white shadow-card" : "border-transparent hover:bg-white/70",
                    )}
                  >
                    <span className="flex items-start gap-4">
                      <span
                        className={cn(
                          "grid size-11 shrink-0 place-items-center rounded-full font-brand text-lg font-extrabold transition-[background-color,color,box-shadow] duration-300",
                          on
                            ? "bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-badge ring-4 ring-brand-100"
                            : done
                              ? "bg-primary text-primary-foreground"
                              : "border border-line bg-white text-primary",
                        )}
                      >
                        {i + 1}
                      </span>
                      <span className="pt-1.5">
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

          <div className={cn(card, "p-4 sm:p-5 lg:sticky lg:top-[calc(var(--spacing-nav)+1rem)]")}>
            <div className="mb-3 flex items-center gap-1.5" aria-hidden>
              <i className="size-2.5 rounded-full bg-line-strong" />
              <i className="size-2.5 rounded-full bg-line-strong" />
              <i className="size-2.5 rounded-full bg-line-strong" />
              <span className="ml-2 text-caption font-semibold text-muted-foreground">Vista de ejemplo</span>
            </div>
            {/* Foto del paso: las cuatro apiladas; cambia con fundido y un zoom muy lento mientras dura el paso */}
            <div className="relative isolate aspect-[16/10] overflow-hidden rounded-2xl bg-brand-100 sm:aspect-[2/1]">
              {photos.map((p, i) => (
                <Image
                  key={p.alt}
                  src={p.src}
                  alt={i === active ? p.alt : ""}
                  aria-hidden={i === active ? undefined : true}
                  fill
                  sizes="(min-width: 1024px) 620px, 100vw"
                  placeholder="blur"
                  className={cn(
                    "object-cover transition-[opacity,scale] ease-out motion-reduce:transition-none",
                    i === active ? "scale-[1.04] opacity-100 duration-[600ms,5500ms]" : "scale-100 opacity-0 duration-[600ms,0ms] delay-[0ms,600ms]",
                  )}
                />
              ))}
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-linear-to-t from-brand-900/70 via-brand-900/15 to-transparent" />
            </div>
            <div
              key={active}
              className="relative mx-3 -mt-14 min-h-75 rounded-2xl border border-line-soft bg-white p-4 shadow-lift animate-in fade-in slide-in-from-bottom-2 duration-500 sm:mx-5 sm:p-5"
            >
              <Preview />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

