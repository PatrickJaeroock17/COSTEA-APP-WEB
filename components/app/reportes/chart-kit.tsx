"use client";

// Piezas comunes de los gráficos de Reportes: colores por concepto, animación (apagada con
// prefers-reduced-motion y al imprimir), tooltip y leyenda en español con importes en S/.
import { useSyncExternalStore } from "react";
import { formatMoney } from "@/lib/format";
import { wrapLabel } from "@/lib/report-chart-axis";
import { cn } from "@/lib/utils";

/**
 * Color fijo por concepto en todos los gráficos (DESIGN.md §1 Gráficos). El orden evita poner
 * lima junto a menta (chart-2/chart-3), que no se distinguen bien entre sí.
 */
export const SERIES = {
  mp: { label: "Materia prima", color: "var(--chart-1)" },
  mo: { label: "Mano de obra", color: "var(--chart-2)" },
  cif: { label: "CIF", color: "var(--chart-5)" },
  gastos: { label: "Gastos", color: "var(--chart-4)" },
  idle: { label: "MOD no absorbida", color: "var(--chart-3)" },
  real: { label: "Real", color: "var(--chart-1)" },
  budget: { label: "Presupuesto", color: "var(--chart-4)" },
} as const;

/* ---------------- animación ---------------- */

let printing = false;
function subscribe(onChange: () => void) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const print = window.matchMedia("print");
  const before = () => {
    printing = true;
    onChange();
  };
  const after = () => {
    printing = false;
    onChange();
  };
  reduced.addEventListener("change", onChange);
  print.addEventListener("change", onChange);
  window.addEventListener("beforeprint", before);
  window.addEventListener("afterprint", after);
  return () => {
    reduced.removeEventListener("change", onChange);
    print.removeEventListener("change", onChange);
    window.removeEventListener("beforeprint", before);
    window.removeEventListener("afterprint", after);
  };
}
const snapshot = () => !(printing || window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.matchMedia("print").matches);

/** `true` solo si conviene animar: sin prefers-reduced-motion y fuera de la impresión. */
export function useChartAnimation() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

/* ---------------- formatos ---------------- */

export const num = (v: string | null | undefined) => (v === null || v === undefined ? null : Number(v));
export const pctText = (v: string | number | null | undefined, places = 1) => (v === null || v === undefined ? "—" : `${(Number(v) * 100).toFixed(places)} %`);
export const money = (v: string | null | undefined, currency: string) => formatMoney(v, currency);
/** Eje en soles sin decimales: S/ 1,200. */
/** Eje en soles sin decimales: S/ 1,200, con espacio no separable (Recharts parte las marcas en los espacios normales). */
const NBSP = String.fromCharCode(160);
export const axisMoney = (currency: string) => (v: number) => formatMoney(String(v), currency, 0).replace(" ", NBSP);
/* ---------------- nombres de plato en el eje ---------------- */

/** Ancho del eje de nombres y caracteres por línea (12 px de fuente ≈ 6,6 px por carácter). */
export const NAME_AXIS = { width: 124, chars: 17, lineHeight: 14 } as const;

/** Alto de fila según el nombre más largo (1–3 líneas), para que las líneas no se pisen. */
export const rowHeight = (names: string[], base: number) => Math.max(base, Math.max(1, ...names.map((n) => wrapLabel(n, NAME_AXIS.chars).length)) * NAME_AXIS.lineHeight + 14);

/** Marca del eje Y con el nombre completo, en varias líneas si no cabe (nunca "…"). */
export function NameTick({ x, y, payload }: { x?: number | string; y?: number | string; payload?: { value?: unknown } }) {
  const lines = wrapLabel(String(payload?.value ?? ""), NAME_AXIS.chars);
  const first = -((lines.length - 1) * NAME_AXIS.lineHeight) / 2;
  return (
    <text x={Number(x)} y={Number(y)} textAnchor="end" dominantBaseline="central" className="fill-ink-soft text-xs">
      {lines.map((l, i) => (
        <tspan key={i} x={Number(x) - 6} dy={i === 0 ? first : NAME_AXIS.lineHeight}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

/* ---------------- tooltip ---------------- */

export type TooltipRow = {
  label: string;
  value: string;
  color?: string;
  strong?: boolean;
};

export function TooltipBox({ title, rows }: { title?: string; rows: TooltipRow[] }) {
  return (
    <div className="grid min-w-44 gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-xs shadow-soft">
      {title && <p className="font-bold text-heading">{title}</p>}
      {rows.map((r) => (
        <div key={r.label} className={cn("flex items-center justify-between gap-4", r.strong && "border-t border-line-soft pt-1.5")}>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            {r.color && <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: r.color }} aria-hidden />}
            {r.label}
          </span>
          <span className={cn("tabular-nums text-ink", r.strong && "font-bold text-heading")}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Contenido de tooltip a partir del dato completo de la fila (no de la serie), con el texto decimal exacto. */
export function datumTooltip<T>(build: (datum: T) => { title?: string; rows: TooltipRow[] }) {
  return function renderTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> }) {
    const datum = payload?.[0]?.payload as T | undefined;
    if (!active || !datum) return null;
    return <TooltipBox {...build(datum)} />;
  };
}

/* ---------------- leyenda ---------------- */

export function Legend({ items, className }: { items: { label: string; color: string; mark?: "line" }[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-soft", className)}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          {i.mark === "line" ? (
            <span className="h-3 w-0.5 rounded-full" style={{ backgroundColor: i.color }} aria-hidden />
          ) : (
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: i.color }} aria-hidden />
          )}
          {i.label}
        </li>
      ))}
    </ul>
  );
}
