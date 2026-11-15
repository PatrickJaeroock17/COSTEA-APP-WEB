"use client";

import { useMemo, useState } from "react";
import Decimal from "decimal.js";
import { motion, useReducedMotion } from "motion/react";
import { DotGrid } from "@/components/landing/decor";
import { cardDark } from "@/components/landing/styles";
import { EASE } from "@/components/motion/reveal";
import { IGV, soles } from "@/lib/costing/price";
import { cn, focusRingDark } from "@/lib/utils";

// Platos de ejemplo: costo completo y precio de carta (con IGV).
const DISHES = [
  { name: "Ceviche clásico", cost: "7.52", price: "28.00" },
  { name: "Arroz con mariscos", cost: "9.80", price: "26.00" },
  { name: "Lomo saltado", cost: "11.40", price: "25.00" },
  { name: "Jalea mixta", cost: "14.60", price: "34.00" },
];

type Sort = "margin" | "result";

export function BenefitsDemo() {
  const [sort, setSort] = useState<Sort>("margin");
  const [selected, setSelected] = useState("Ceviche clásico");
  const reduced = useReducedMotion();

  const rows = useMemo(() => {
    const list = DISHES.map((d) => {
      const net = new Decimal(d.price).div(IGV.plus(1));
      const result = net.minus(d.cost);
      return { ...d, result, margin: result.div(net) };
    });
    return list.sort((a, b) => (sort === "margin" ? b.margin.comparedTo(a.margin) : b.result.comparedTo(a.result)));
  }, [sort]);

  const max = rows.reduce((m, r) => Decimal.max(m, sort === "margin" ? r.margin : r.result), new Decimal(0));
  const sel = rows.find((r) => r.name === selected) ?? rows[0];

  return (
    <div className="relative">
      {/* Tarjetas de la portada, ahora con los datos del plato elegido */}
      <div className="hero-bob pointer-events-none absolute -top-7 right-4 z-10 rounded-2xl bg-white px-4 py-2.5 shadow-float [--bob-dur:5s] sm:right-8">
        <p className="text-xs font-semibold text-muted-foreground">Costo completo (ejemplo)</p>
        <p className="font-brand text-xl font-extrabold tabular-nums text-heading">{soles(sel.cost)}</p>
      </div>
      <div className="hero-bob pointer-events-none absolute -bottom-6 right-4 z-10 rounded-2xl bg-lime-500 px-4 py-2.5 shadow-float [--bob-delay:0.6s] [--bob-dur:5.8s] sm:right-8">
        <p className="text-xs font-semibold text-brand-800">Margen (ejemplo)</p>
        <p className="font-brand text-xl font-extrabold tabular-nums text-brand-900">{(sel.margin.toNumber() * 100).toFixed(0)} %</p>
      </div>

      <div className={cn(cardDark, "p-5 pb-10 pt-10 sm:p-7 sm:pb-11 sm:pt-11")}>
        <DotGrid tone="dark" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <p className="font-brand text-lg font-extrabold text-white">Tu carta, plato por plato</p>
          <div className="flex rounded-full bg-white/10 p-1 text-xs font-bold" role="group" aria-label="Ordenar por">
            {(
              [
                ["margin", "Margen %"],
                ["result", "Utilidad S/"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setSort(k)}
                aria-pressed={sort === k}
                className={cn(
                  "rounded-full px-3.5 py-1.5 transition-colors",
                  focusRingDark,
                  sort === k ? "bg-lime-500 text-brand-900" : "text-sidebar-foreground hover:text-white",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <ul key={sort} className="relative mt-5 space-y-2.5">
          {rows.map((r, i) => {
            const v = sort === "margin" ? r.margin : r.result;
            const pct = max.isZero() ? 0 : v.div(max).times(100).toNumber();
            const on = r.name === sel.name;
            return (
              <li key={r.name} style={{ animationDelay: `${i * 70}ms` }} className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500">
                <button
                  type="button"
                  onClick={() => setSelected(r.name)}
                  aria-pressed={on}
                  className={cn(
                    "w-full rounded-2xl px-4 py-3 text-left transition-colors",
                    focusRingDark,
                    on ? "bg-white/12 ring-1 ring-lime-500/50" : "bg-white/5 hover:bg-white/10",
                  )}
                >
                  <span className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-bold text-white">{r.name}</span>
                    <span className="font-brand font-extrabold tabular-nums text-lime-300">
                      {sort === "margin" ? `${(r.margin.toNumber() * 100).toFixed(0)} %` : soles(r.result)}
                    </span>
                  </span>
                  <span className="mt-2 block h-2 overflow-hidden rounded-full bg-white/10">
                    {/* La barra ocupa todo el riel y se desliza desde la izquierda: solo transform, sin cambiar el ancho */}
                    <motion.span
                      className={cn("block h-full rounded-full", i === 0 ? "bg-lime-500" : "bg-lime-500/55")}
                      initial={reduced ? false : { x: "-100%" }}
                      whileInView={{ x: `${pct - 100}%` }}
                      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
                      transition={{ duration: 0.7, ease: EASE, delay: 0.1 + i * 0.07 }}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="relative mt-4 text-xs text-sidebar-foreground">Valores de ejemplo, con IGV 18 %. Toca un plato para ver su costo y margen.</p>
      </div>
    </div>
  );
}

