"use client";

import { useMemo, useState } from "react";
import Decimal from "decimal.js";
import { Plus, RotateCcw, TrendingUp } from "lucide-react";
import { AnimatedNumber } from "@/components/landing/reveal";
import { movingAverage, priceFromMargin, soles } from "@/lib/costing/price";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const fmt = (n: number) => `S/ ${n.toFixed(2)}`;

/** Botón de las demos: el primario de components/ui en píldora pequeña. */
const pill = cn(buttonVariants({ shape: "pill", size: "sm" }), "h-auto min-h-9 gap-1.5 px-4 py-2 text-left text-small font-bold whitespace-normal");

/* ───────────── Platos y recetas: el costo se recalcula al cambiar un insumo ───────────── */

const INGREDIENTS = [
  { name: "Pescado fresco", qty: "0.20", unit: "kg", price: "30.00" },
  { name: "Limón", qty: "0.10", unit: "kg", price: "8.00" },
  { name: "Cebolla roja", qty: "0.08", unit: "kg", price: "4.00" },
  { name: "Ají limo", qty: "0.02", unit: "kg", price: "20.00" },
];

export function RecipeDemo() {
  const [up, setUp] = useState(false);
  const rows = useMemo(
    () =>
      INGREDIENTS.map((i, idx) => {
        const price = new Decimal(idx === 0 && up ? "33.00" : i.price);
        return { ...i, price, line: price.times(i.qty) };
      }),
    [up],
  );
  const total = rows.reduce((s, r) => s.plus(r.line), new Decimal(0));

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">Ceviche clásico · ejemplo</p>
      <ul className="mt-3 divide-y divide-line text-sm">
        {rows.map((r, idx) => (
          <li key={r.name} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block truncate font-semibold text-heading">{r.name}</span>
              <span className={cn("text-xs text-muted-foreground transition-colors", idx === 0 && up && "font-bold text-danger-text")}>
                {r.qty} {r.unit} × {soles(r.price)}
              </span>
            </span>
            <span className="shrink-0 font-bold tabular-nums text-heading">{soles(r.line)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-end justify-between rounded-2xl bg-primary px-4 py-3 text-primary-foreground">
        <span className="text-xs font-semibold text-lime-300">Costo por plato</span>
        <span className="font-brand text-2xl font-extrabold tabular-nums">
          <AnimatedNumber value={total.toNumber()} format={fmt} />
        </span>
      </div>
      <button type="button" onClick={() => setUp((v) => !v)} className={cn(pill, "mt-3")}>
        <TrendingUp className="size-4" aria-hidden />
        {up ? "Volver al precio anterior" : "Sube el pescado a S/ 33.00"}
      </button>
    </div>
  );
}

/* ───────────── Costo y precio: margen → precio sugerido con IGV ───────────── */

export function PriceDemo() {
  const [margin, setMargin] = useState(33);
  const cost = new Decimal("10.00");
  const p = priceFromMargin(cost, new Decimal(margin).div(100));
  const costShare = Math.round((cost.div(p.net).toNumber()) * 100);

  return (
    <div>
      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
        <span>Costo completo (ejemplo)</span>
        <span className="font-brand text-base font-extrabold text-heading">{soles(cost)}</span>
      </div>

      <label className="mt-4 block">
        <span className="flex items-center justify-between text-sm font-semibold text-heading">
          Margen que quieres ganar
          <span className="rounded-full bg-lime-500 px-2.5 py-0.5 text-xs font-extrabold tabular-nums text-heading">{margin} %</span>
        </span>
        <input
          type="range"
          min={10}
          max={60}
          value={margin}
          onChange={(e) => setMargin(Number(e.target.value))}
          className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-primary"
          aria-label="Margen deseado"
        />
      </label>

      <div className="mt-4 rounded-2xl bg-primary px-4 py-3 text-primary-foreground">
        <p className="text-xs font-semibold text-lime-300">Precio sugerido (con IGV 18 %)</p>
        <p className="font-brand text-3xl font-extrabold tabular-nums">
          <AnimatedNumber value={p.final.toNumber()} format={fmt} />
        </p>
      </div>

      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="bg-brand-900 transition-[width] duration-500" style={{ width: `${costShare}%` }} />
        <div className="flex-1 bg-lime-500" />
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Sin IGV</dt>
          <dd className="font-bold tabular-nums text-heading">{soles(p.net)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">IGV</dt>
          <dd className="font-bold tabular-nums text-heading">{soles(p.tax)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Utilidad</dt>
          <dd className="font-bold tabular-nums text-primary">{soles(p.result)}</dd>
        </div>
      </dl>
    </div>
  );
}

/* ───────────── Inventario: kardex con promedio ponderado móvil ───────────── */

type Move = { kind: "in" | "out"; qty: number; cost?: number };
const BASE: Move[] = [
  { kind: "in", qty: 10, cost: 8 },
  { kind: "in", qty: 10, cost: 10 },
  { kind: "out", qty: 6 },
];
const EXTRA: Move = { kind: "in", qty: 5, cost: 12 };

export function KardexDemo() {
  const [moves, setMoves] = useState<Move[]>(BASE);
  const rows = useMemo(() => {
    const out: (Move & { stock: Decimal; avg: Decimal })[] = [];
    for (const m of moves) {
      const prev = out[out.length - 1];
      const stock = prev?.stock ?? new Decimal(0);
      const avg = prev?.avg ?? new Decimal(0);
      // Las entradas recalculan el promedio; las salidas salen al promedio vigente.
      out.push(
        m.kind === "in"
          ? { ...m, stock: stock.plus(m.qty), avg: movingAverage(stock, avg, String(m.qty), String(m.cost!)) }
          : { ...m, stock: stock.minus(m.qty), avg },
      );
    }
    return out;
  }, [moves]);  const last = rows[rows.length - 1];
  const added = moves.length > BASE.length;

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">Pescado fresco (kg) · ejemplo</p>
      <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-card text-xs">
        <div className="grid grid-cols-[1.6fr_0.7fr_0.7fr_1fr] bg-surface px-3 py-2 font-bold text-muted-foreground">
          <span>Movimiento</span>
          <span className="text-right">Cant.</span>
          <span className="text-right">Saldo</span>
          <span className="text-right">Promedio</span>
        </div>
        {rows.map((r, i) => (
          <div
            key={i}
            className={cn(
              "grid grid-cols-[1.6fr_0.7fr_0.7fr_1fr] items-center border-t border-line-soft px-3 py-2 tabular-nums",
              i === rows.length - 1 && added && "animate-in fade-in slide-in-from-bottom-2 bg-lime-500/25 duration-500",
            )}
          >
            <span className="whitespace-nowrap font-semibold text-heading">
              {r.kind === "in" ? `Compra ${soles(String(r.cost!))}` : "Salida"}
            </span>
            <span className={cn("text-right font-semibold", r.kind === "in" ? "text-primary" : "text-danger-text")}>
              {r.kind === "in" ? "+" : "−"}
              {r.qty}
            </span>
            <span className="text-right text-heading">{r.stock.toFixed(0)}</span>
            <span className="text-right font-bold text-heading">{soles(r.avg)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-end justify-between rounded-2xl bg-primary px-4 py-3 text-primary-foreground">
        <span className="text-xs font-semibold text-lime-300">Costo promedio actual</span>
        <span className="font-brand text-2xl font-extrabold tabular-nums">
          <AnimatedNumber value={last.avg.toNumber()} format={fmt} />
        </span>
      </div>
      <button type="button" onClick={() => setMoves(added ? BASE : [...BASE, EXTRA])} className={cn(pill, "mt-3")}>
        {added ? <RotateCcw className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
        {added ? "Reiniciar ejemplo" : "Registrar compra: 5 kg a S/ 12.00"}
      </button>
    </div>
  );
}


