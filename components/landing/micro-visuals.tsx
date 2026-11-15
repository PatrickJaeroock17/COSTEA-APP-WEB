import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Micro-visuales del bento de "Qué incluye": una mini tabla, barra o gráfico por tarjeta.
 * Son ilustraciones con valores de ejemplo (los mismos platos e insumos de las demos), no datos de clientes:
 * van con `aria-hidden` porque el texto de la tarjeta ya dice lo mismo.
 */

const frame = "rounded-2xl border border-line-soft bg-white/70 p-3 text-xs";
const caption = "text-caption font-semibold text-muted-foreground";

/** Insumos y precios: dos versiones de precio del mismo insumo. */
export function PriceVersionsVisual() {
  const rows = [
    { tag: "v1", date: "Oct", price: "S/ 30.00", on: false },
    { tag: "v2", date: "Nov", price: "S/ 33.00", on: true },
  ];
  return (
    <div aria-hidden className={frame}>
      <p className={caption}>Pescado fresco (kg) · ejemplo</p>
      <ul className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <li key={r.tag} className={cn("flex items-center gap-2 rounded-xl px-2.5 py-1.5", r.on ? "bg-brand-50" : "bg-surface-page")}>
            <span className={cn("rounded-full px-1.5 py-0.5 text-caption font-bold", r.on ? "bg-primary text-primary-foreground" : "bg-line text-ink-soft")}>{r.tag}</span>
            <span className="text-muted-foreground">{r.date}</span>
            <span className={cn("ml-auto font-bold tabular-nums", r.on ? "text-heading" : "text-muted-foreground line-through")}>{r.price}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Personal: reparto entre mano de obra directa e indirecta. */
export function LaborVisual() {
  return (
    <div aria-hidden className={frame}>
      <p className={caption}>Planilla del mes · ejemplo</p>
      <div className="mt-2.5 flex h-3 overflow-hidden rounded-full bg-line">
        <span className="w-[62%] bg-primary" />
        <span className="w-[38%] bg-lime-500" />
      </div>
      <div className="mt-2 flex justify-between font-semibold text-ink-soft">
        <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-primary" /> Directa</span>
        <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-lime-500" /> Indirecta</span>
      </div>
    </div>
  );
}

/** Gastos: los tres grupos, cada uno con su barra. */
export function ExpensesVisual() {
  const rows = [
    { label: "Costos indirectos", w: "w-[78%]", color: "bg-primary" },
    { label: "Administración", w: "w-[52%]", color: "bg-brand-300" },
    { label: "Ventas", w: "w-[34%]", color: "bg-lime-500" },
  ];
  return (
    <div aria-hidden className={cn(frame, "space-y-2")}>
      {rows.map((r) => (
        <div key={r.label}>
          <p className="font-semibold text-ink-soft">{r.label}</p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
            <span className={cn("block h-full rounded-full", r.w, r.color)} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Plan de producción: mini tabla de platos a preparar. */
export function PlanVisual() {
  const rows = [
    ["Ceviche clásico", "120"],
    ["Arroz con mariscos", "80"],
    ["Lomo saltado", "60"],
  ];
  return (
    <div aria-hidden className={cn(frame, "p-0")}>
      <div className="flex justify-between border-b border-line-soft px-3 py-1.5 font-bold text-muted-foreground">
        <span>Plato · ejemplo</span>
        <span>Platos</span>
      </div>
      {rows.map(([name, qty]) => (
        <div key={name} className="flex justify-between border-b border-line-soft px-3 py-1.5 last:border-0">
          <span className="font-semibold text-heading">{name}</span>
          <span className="font-bold tabular-nums text-primary">{qty}</span>
        </div>
      ))}
    </div>
  );
}

/** Presupuestos: publicado (fijo) y comparado con lo real. */
export function BudgetVisual() {
  const rows = [
    { label: "Presupuesto", w: "w-[82%]", color: "bg-brand-200" },
    { label: "Real", w: "w-[74%]", color: "bg-primary" },
  ];
  return (
    <div aria-hidden className={frame}>
      <p className="flex items-center justify-between">
        <span className={caption}>Noviembre · ejemplo</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-caption font-bold text-brand-700">
          <Lock className="size-3" /> Publicado
        </span>
      </p>
      <div className="mt-2.5 space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[5rem_1fr] items-center gap-2">
            <span className="font-semibold text-ink-soft">{r.label}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-line">
              <span className={cn("block h-full rounded-full", r.w, r.color)} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Ventas: columnas del mes, la última en lima. */
export function SalesVisual() {
  const bars = ["h-[38%]", "h-[55%]", "h-[46%]", "h-[70%]", "h-[62%]", "h-[88%]"];
  return (
    <div aria-hidden className={frame}>
      <p className={caption}>Ventas por semana · ejemplo</p>
      <div className="mt-2 flex h-16 items-end gap-1.5">
        {bars.map((h, i) => (
          <span key={i} className={cn("flex-1 rounded-t-md", h, i === bars.length - 1 ? "bg-lime-500" : "bg-primary/80")} />
        ))}
      </div>
    </div>
  );
}

/** Lista de comprobación en lima para la tarjeta oscura. */
export function DarkChecks({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2 text-small font-semibold text-sidebar-foreground">
      {items.map((t) => (
        <li key={t} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
          <Check className="size-3.5 text-lime-500" strokeWidth={3} aria-hidden /> {t}
        </li>
      ))}
    </ul>
  );
}
