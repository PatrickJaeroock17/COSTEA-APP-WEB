"use client";

import { useMemo, useState } from "react";
import Decimal from "decimal.js";
import { IGV, money } from "@/lib/costing/price";
import { cn } from "@/lib/utils";

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
      <div className="hero-bob pointer-events-none absolute -top-7 right-4 z-10 rounded-2xl bg-white px-4 py-2.5 shadow-[0_12px_30px_rgba(3,42,31,0.18)] [--bob-dur:5s] sm:right-8">
        <p className="text-xs font-semibold text-[#5b6b65]">Costo completo (ejemplo)</p>
        <p className="font-brand text-xl font-extrabold tabular-nums text-[#032a1f]">{money(sel.cost)}</p>
      </div>
      <div className="hero-bob pointer-events-none absolute -bottom-6 right-4 z-10 rounded-2xl bg-[#006b4b] px-4 py-2.5 shadow-[0_12px_30px_rgba(3,42,31,0.25)] [--bob-delay:0.6s] [--bob-dur:5.8s] sm:right-8">
        <p className="text-xs font-semibold text-[#d8ee9c]">Margen (ejemplo)</p>
        <p className="font-brand text-xl font-extrabold tabular-nums text-white">{(sel.margin.toNumber() * 100).toFixed(0)} %</p>
      </div>

      <div className="rounded-[28px] border border-[#ead9b3]/70 bg-white p-5 pb-10 pt-10 shadow-[0_10px_30px_rgba(3,42,31,0.06)] sm:p-7 sm:pb-11 sm:pt-11">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-brand text-lg font-extrabold text-[#032a1f]">Tu carta, plato por plato</p>
          <div className="flex rounded-full bg-[#f4e6c9]/70 p-1 text-xs font-bold" role="group" aria-label="Ordenar por">
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
                  sort === k ? "bg-[#006b4b] text-white" : "text-[#3f524b] hover:text-[#032a1f]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <ul key={sort} className="mt-5 space-y-2.5">
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
                    on ? "bg-[#ecf8f2] ring-1 ring-[#006b4b]/30" : "bg-[#faf3e0] hover:bg-[#f4e6c9]/70",
                  )}
                >
                  <span className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-bold text-[#032a1f]">{r.name}</span>
                    <span className="font-brand font-extrabold tabular-nums text-[#006b4b]">
                      {sort === "margin" ? `${(r.margin.toNumber() * 100).toFixed(0)} %` : money(r.result)}
                    </span>
                  </span>
                  <span className="mt-2 block h-2 overflow-hidden rounded-full bg-[#ead9b3]">
                    <span
                      className={cn("block h-full rounded-full transition-[width] duration-700", i === 0 ? "bg-[#a9d63a]" : "bg-[#006b4b]")}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-[#5b6b65]">Valores de ejemplo, con IGV 18 %. Toca un plato para ver su costo y margen.</p>
      </div>
    </div>
  );
}

