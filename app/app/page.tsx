import Link from "next/link";
import { AlertTriangle, Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

// Caso de comprobación de GUIA_RAPIDA.md: ventas 12 000, costo por unidad 10, margen 30 %, utilidad 3 600.
// Fase 5 reemplaza estos valores de ejemplo por los datos reales del restaurante.
const kpis = [
  { label: "Ventas netas del mes", value: "S/ 12,000", note: "Sin IGV · plan activo" },
  { label: "Costo completo por unidad", value: "S/ 10.00", note: "Producción + gastos asignados" },
  { label: "Margen operativo", value: "30 %", note: "Sobre la venta neta" },
];

type Step = { title: string; text: string; state: "done" | "current" | "locked"; href: string; n?: number };
const steps: Step[] = [
  { title: "Insumos y materia prima", text: "Precios y unidades del catálogo", state: "done", href: "/app/insumos" },
  { title: "Platos y recetas", text: "Recetas con versión vigente", state: "done", href: "/app/platos" },
  { title: "Personal", text: "Costo mensual y reparto por área", state: "done", href: "/app/personal" },
  { title: "Gastos", text: "Faltan los gastos de ventas del mes", state: "current", href: "/app/gastos", n: 4 },
  { title: "Costo y precio por plato", text: "Se activa al completar los gastos", state: "locked", href: "/app/costos" },
  { title: "Plan de producción", text: "Se activa al tener costo y precio", state: "locked", href: "/app/plan" },
];
const done = steps.filter((s) => s.state === "done").length;

const alerts = [
  { tone: "warn", title: "Gastos de ventas sin registrar", text: "El costo completo por plato queda incompleto hasta registrarlos." },
  { tone: "warn", title: "Insumos con precio desactualizado", text: "Revisa los precios de compra antes de publicar un presupuesto." },
  { tone: "ok", title: "Personal al día", text: "Todos los trabajadores tienen su costo mensual." },
] as const;

const card = "rounded-[24px] border border-[#e2e9e5] bg-white";

export default function InicioPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="font-brand text-4xl font-extrabold tracking-[-0.025em] text-[#032a1f] sm:text-5xl">Hola, Patrick</h1>
          <p className="mt-2 text-lg text-[#5b6b65]">Así va el costeo de tu restaurante este mes.</p>
        </div>
        <Link
          href="/app/gastos"
          className="inline-flex min-h-12 items-center rounded-2xl bg-[#006b4b] px-6 text-base font-extrabold text-white transition-colors hover:bg-[#00563d]"
        >
          Continuar: gastos de ventas
        </Link>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className={cn(card, "p-6")}>
            <p className="text-[15px] font-medium text-[#5b6b65]">{k.label}</p>
            <p className="mt-2 font-brand text-4xl font-extrabold tracking-[-0.02em] text-[#032a1f]">{k.value}</p>
            <p className="mt-1.5 text-sm text-[#5b6b65]">{k.note}</p>
          </div>
        ))}
        <div className={cn(card, "p-6 md:col-span-3")}>
          <p className="text-[15px] font-medium text-[#5b6b65]">Utilidad estimada</p>
          <p className="mt-2 font-brand text-4xl font-extrabold tracking-[-0.02em] text-[#032a1f]">S/ 3,600</p>
          <p className="mt-1.5 text-sm text-[#5b6b65]">Ventas menos costos del mes</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <section className={cn(card, "p-6 sm:p-7")} aria-labelledby="config">
          <div className="flex items-center justify-between gap-4">
            <h2 id="config" className="font-brand text-2xl font-extrabold text-[#032a1f]">Configura tu restaurante</h2>
            <span className="text-sm font-bold text-[#006b4b]">{done} de {steps.length} listos</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e2e9e5]" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done}>
            <div className="h-full rounded-full bg-[#006b4b]" style={{ width: `${(done / steps.length) * 100}%` }} />
          </div>
          <ul className="mt-2 divide-y divide-[#e2e9e5]">
            {steps.map((s) => (
              <li key={s.title} className="flex items-center gap-4 py-4">
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full font-brand font-extrabold",
                    s.state === "done" && "bg-[#d2efe1] text-[#006b4b]",
                    s.state === "current" && "bg-[#a9d63a] text-[#032a1f]",
                    s.state === "locked" && "bg-[#eef2f0] text-[#7b8a84]",
                  )}
                >
                  {s.state === "done" ? <Check className="size-5" strokeWidth={2.5} aria-hidden /> : s.state === "locked" ? <Lock className="size-4" aria-hidden /> : s.n}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block font-bold", s.state === "locked" ? "text-[#5b6b65]" : "text-[#032a1f]")}>{s.title}</span>
                  <span className="block text-sm text-[#5b6b65]">{s.text}</span>
                </span>
                {s.state === "done" && <Link href={s.href} className="text-sm font-bold text-[#006b4b] hover:underline">Ver</Link>}
                {s.state === "current" && (
                  <Link href={s.href} className="rounded-xl bg-[#006b4b] px-5 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-[#00563d]">Completar</Link>
                )}
                {s.state === "locked" && <span className="text-sm text-[#7b8a84]">Pendiente</span>}
              </li>
            ))}
          </ul>
        </section>

        <section className={cn(card, "p-6 sm:p-7")} aria-labelledby="atencion">
          <h2 id="atencion" className="font-brand text-2xl font-extrabold text-[#032a1f]">Requiere tu atención</h2>
          <ul className="mt-5 space-y-3">
            {alerts.map((a) => (
              <li key={a.title} className={cn("flex gap-3 rounded-2xl p-4", a.tone === "warn" ? "bg-[#fef3d8]" : "bg-[#e7f6ee]")}>
                {a.tone === "warn" ? (
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#b7791f]" aria-hidden />
                ) : (
                  <Check className="mt-0.5 size-5 shrink-0 text-[#006b4b]" strokeWidth={2.5} aria-hidden />
                )}
                <span>
                  <span className="block font-bold text-[#032a1f]">{a.title}</span>
                  <span className="block text-sm leading-relaxed text-[#3f524b]">{a.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
