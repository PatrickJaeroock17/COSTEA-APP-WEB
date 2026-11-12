"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Reveal, useInView, usePrefersReducedMotion } from "@/components/landing/reveal";
import { priceFromMargin, soles } from "@/lib/costing/price";
import { cn } from "@/lib/utils";

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
    <div className="rounded-xl border border-[#ead9b3] bg-white px-3 py-2">
      <p className="text-[11px] font-semibold text-[#5b6b65]">{label}</p>
      <p className="text-sm font-bold text-[#032a1f]">{value}</p>
    </div>
  );
}

function PreviewRestaurant() {
  const months = ["Ago", "Sep", "Oct", "Nov", "Dic"];
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-wide text-[#006b4b]">Nuevo restaurante</p>
      <Field label="Nombre" value="Mi cevichería (ejemplo)" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Moneda" value="Soles (PEN)" />
        <Field label="IGV" value="18 %" />
      </div>
      <div>
        <p className="mb-2 text-[11px] font-semibold text-[#5b6b65]">Mes de trabajo</p>
        <div className="flex flex-wrap gap-2">
          {months.map((m) => (
            <span
              key={m}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-bold",
                m === "Nov" ? "bg-[#006b4b] text-white" : "bg-white text-[#3f524b] ring-1 ring-[#ead9b3]",
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
        <p className="text-xs font-bold uppercase tracking-wide text-[#006b4b]">Configuración</p>
        <p className="text-xs font-bold text-[#032a1f]">4 de 4</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#ead9b3]">
        <div className="h-full w-full grow-x origin-left rounded-full bg-[#006b4b]" />
      </div>
      <ul className="mt-4 space-y-2.5">
        {items.map((t, i) => (
          <li
            key={t}
            style={{ animationDelay: `${i * 160}ms` }}
            className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-[#ead9b3] animate-in fade-in slide-in-from-left-3 fill-mode-both duration-500"
          >
            <span className="grid size-6 place-items-center rounded-full bg-[#a9d63a] text-[#032a1f]">
              <Check className="size-3.5" strokeWidth={3} aria-hidden />
            </span>
            <span className="text-sm font-bold text-[#032a1f]">{t}</span>
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
      <p className="text-xs font-bold uppercase tracking-wide text-[#006b4b]">Costo y precio por plato · margen 35 %</p>
      <ul className="mt-3 space-y-2.5">
        {DISHES.map((d, i) => {
          const p = priceFromMargin(d.cost, "0.35");
          return (
            <li
              key={d.name}
              style={{ animationDelay: `${i * 140}ms` }}
              className="grid grid-cols-[1fr_auto] items-center gap-x-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-[#ead9b3] animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
            >
              <span>
                <span className="block text-sm font-bold text-[#032a1f]">{d.name}</span>
                <span className="text-xs text-[#5b6b65]">Costo {soles(d.cost)}</span>
              </span>
              <span className="text-right">
                <span className="block font-brand text-lg font-extrabold tabular-nums text-[#006b4b]">{soles(p.final)}</span>
                <span className="rounded-full bg-[#a9d63a]/50 px-2 py-0.5 text-[11px] font-bold text-[#032a1f]">
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
        <p className="text-xs font-bold uppercase tracking-wide text-[#006b4b]">Presupuesto vs. ventas</p>
        <p className="flex items-center gap-3 text-[11px] font-semibold text-[#3f524b]">
          <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-[#ead9b3]" /> Presupuesto</span>
          <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-[#006b4b]" /> Ventas</span>
        </p>
      </div>
      <div className="mt-4 flex h-44 items-end justify-between gap-3">
        {WEEKS.map((w, i) => (
          <div key={w.label} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-36 w-full items-end justify-center gap-1.5">
              <div
                style={{ height: `${w.plan}%`, animationDelay: `${i * 120}ms` }}
                className="w-1/2 grow-y origin-bottom rounded-t-lg bg-[#ead9b3]"
              />
              <div
                style={{ height: `${w.real}%`, animationDelay: `${i * 120 + 80}ms` }}
                className="w-1/2 grow-y origin-bottom rounded-t-lg bg-[#006b4b]"
              />
            </div>
            <span className="text-[11px] font-semibold text-[#5b6b65]">{w.label}</span>
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
    <section id="como-funciona" className="scroll-mt-4 bg-[#f4e6c9] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal>
          <span className="inline-block rounded-full bg-white/70 px-3.5 py-[7px] text-[13px] font-bold text-[#00563d]">
            En cuatro pasos
          </span>
          <h2 className="mt-4 font-brand text-4xl font-extrabold leading-[1.05] tracking-[-0.025em] text-[#032a1f] sm:text-5xl">
            Cómo funciona
          </h2>
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
                      "relative w-full overflow-hidden rounded-[24px] p-5 text-left transition-all duration-300 sm:p-6",
                      on
                        ? "bg-white shadow-[0_18px_40px_rgba(3,42,31,0.12)]"
                        : "bg-white/50 hover:bg-white/80",
                    )}
                  >
                    <span className="flex items-start gap-4">
                      <span
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-full font-brand text-lg font-extrabold transition-colors duration-300",
                          on ? "bg-[#006b4b] text-white" : "bg-[#006b4b]/10 text-[#006b4b]",
                        )}
                      >
                        {i + 1}
                      </span>
                      <span>
                        <span className="block font-brand text-xl font-extrabold text-[#032a1f]">{s.title}</span>
                        <span
                          className={cn(
                            "block overflow-hidden text-sm leading-relaxed text-[#3f524b] transition-all duration-300",
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
                        className="step-progress absolute inset-x-0 bottom-0 h-1 origin-left bg-[#a9d63a]"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="rounded-[28px] border border-[#ead9b3]/70 bg-white p-4 shadow-[0_10px_30px_rgba(3,42,31,0.06)] sm:p-5 lg:sticky lg:top-8">
            <div className="mb-3 flex items-center gap-1.5" aria-hidden>
              <i className="size-2.5 rounded-full bg-[#ead9b3]" />
              <i className="size-2.5 rounded-full bg-[#ead9b3]" />
              <i className="size-2.5 rounded-full bg-[#ead9b3]" />
              <span className="ml-2 text-[11px] font-semibold text-[#5b6b65]">Vista de ejemplo</span>
            </div>
            <div key={active} className="min-h-[300px] rounded-2xl bg-[#faf3e0] p-4 animate-in fade-in slide-in-from-bottom-2 duration-500 sm:p-5">
              <Preview />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

