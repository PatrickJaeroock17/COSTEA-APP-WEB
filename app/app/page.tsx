import Link from "next/link";
import { Suspense } from "react";
import { CreateRestaurant } from "@/components/app/create-restaurant";
import { getAppContext } from "@/lib/auth";
import { D } from "@/lib/costing/decimal";
import { type HomeSummary, getHomeSummary } from "@/lib/data/home";
import { formatMoney } from "@/lib/format";
import { AlertTriangle, Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

// Caso de comprobación de GUIA_RAPIDA.md: se muestra como ejemplo mientras el mes no tiene un plan con cálculo completo.
const EXAMPLE = [
  { label: "Ventas netas del mes", value: "S/ 12,000", note: "Sin IGV · ejemplo" },
  { label: "Costo completo por unidad", value: "S/ 10.00", note: "Producción + gastos asignados" },
  { label: "Margen operativo", value: "30 %", note: "Sobre la venta neta" },
];

type Step = { title: string; text: string; state: "done" | "current" | "locked"; href: string; n?: number };
type Alert = { tone: "warn" | "ok"; title: string; text: string };

const card = "rounded-[24px] border border-[#e2e9e5] bg-white";

export default function InicioPage() {
  return (
    <Suspense>
      <Inicio />
    </Suspense>
  );
}

const pct = (d: InstanceType<typeof D> | null) => (d ? `${d.times(100).toDecimalPlaces(1).toFixed()} %` : "—");
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Pasos de configuración a partir del resumen real del mes. */
function buildSteps(h: HomeSummary, currency: string): Step[] {
  const raw: Omit<Step, "state" | "n">[] = [];
  const doneFlags: boolean[] = [];
  const add = (title: string, href: string, done: boolean, text: string) => {
    raw.push({ title, href, text });
    doneFlags.push(done);
  };
  add(
    "Insumos y materia prima",
    "/app/insumos",
    h.materials.priced > 0,
    h.materials.active ? `${plural(h.materials.priced, "insumo", "insumos")} con precio vigente` : "Agrega insumos con su precio",
  );
  add(
    "Platos y recetas",
    "/app/platos",
    h.dishes.withRecipe > 0,
    h.dishes.withRecipe ? `${plural(h.dishes.withRecipe, "plato", "platos")} con receta` : "Crea o trae platos con sus insumos",
  );
  add(
    "Personal",
    "/app/personal",
    h.staff.active > 0 && h.staff.missing.length === 0,
    !h.staff.active
      ? "Registra a tu personal y su costo mensual"
      : h.staff.missing.length
        ? `Falta el costo del mes de ${plural(h.staff.missing.length, "trabajador", "trabajadores")}`
        : "Costo mensual de todo el personal",
  );
  add(
    "Gastos",
    "/app/gastos",
    h.expenses.count > 0 || h.expenses.declaredNone,
    h.expenses.count
      ? `${plural(h.expenses.count, "gasto", "gastos")} · ${formatMoney(h.expenses.monthly, currency)} al mes`
      : h.expenses.declaredNone
        ? "Declarado sin gastos en el plan"
        : "Registra los gastos del mes",
  );
  add(
    "Costo y precio por plato",
    "/app/costos",
    h.calculable,
    h.calculable
      ? "Cálculo completo con el plan del mes"
      : h.plan
        ? plural(h.plan.issues.length, "pendiente en el cálculo", "pendientes en el cálculo")
        : "Se calcula con el plan del mes",
  );
  add(
    "Plan de producción",
    "/app/plan",
    Boolean(h.plan && h.plan.lines > 0),
    h.plan ? `${h.plan.name} · ${plural(h.plan.lines, "plato", "platos")}` : "Define las porciones del mes",
  );
  const first = doneFlags.indexOf(false);
  return raw.map((s, i) => ({ ...s, n: i + 1, state: doneFlags[i] ? "done" : i === first ? "current" : "locked" }));
}

/** Avisos solo cuando el dato real lo justifica. */
function buildAlerts(h: HomeSummary): Alert[] {
  const alerts: Alert[] = [];
  if (h.period && !h.expenses.salesExpense && !h.expenses.noExpensesDeclared) {
    alerts.push({ tone: "warn", title: "Gastos de ventas sin registrar", text: "El costo completo por plato queda incompleto hasta registrarlos." });
  }
  if (h.materials.withoutPrice + h.materials.planPriceIssues.length > 0) {
    alerts.push({
      tone: "warn",
      title: "Insumos con precio desactualizado",
      text: [
        h.materials.withoutPrice ? `${plural(h.materials.withoutPrice, "insumo activo no tiene", "insumos activos no tienen")} precio vigente al fin del mes.` : "",
        h.materials.planPriceIssues.length ? `${plural(h.materials.planPriceIssues.length, "precio del plan necesita", "precios del plan necesitan")} revisión.` : "",
      ]
        .filter(Boolean)
        .join(" "),
    });
  }
  if (h.plan && h.plan.status !== "calculable") {
    alerts.push({ tone: "warn", title: "El plan del mes tiene pendientes", text: h.plan.issues.slice(0, 2).join(" ") || "Revisa el plan de producción." });
  }
  if (h.staff.active) {
    alerts.push(
      h.staff.missing.length
        ? { tone: "warn", title: "Personal sin costo del mes", text: `Falta: ${h.staff.missing.join(", ")}.` }
        : { tone: "ok", title: "Personal al día", text: "Todos los trabajadores tienen su costo mensual." },
    );
  }
  return alerts;
}

async function Inicio() {
  const ctx = await getAppContext();
  const { user, restaurant } = ctx;
  if (!restaurant) return <CreateRestaurant name={user.name.split(" ")[0]} />;
  const home = await getHomeSummary(ctx);
  const steps = buildSteps(home, restaurant.currency);
  const done = steps.filter((s) => s.state === "done").length;
  const alerts = buildAlerts(home);
  const next = steps.find((s) => s.state !== "done");
  const t = home.calculable ? home.totals! : null;
  const kpis = t
    ? [
        { label: "Ventas netas del mes", value: formatMoney(t.sales, restaurant.currency), note: `Sin IGV · ${home.plan!.name}` },
        {
          label: "Costo completo por unidad",
          value: home.portions && !home.portions.isZero() ? formatMoney(t.completeAssigned.div(home.portions), restaurant.currency) : "—",
          note: "Promedio por porción del plan",
        },
        { label: "Margen operativo", value: pct(t.margin), note: "Sobre la venta neta" },
      ]
    : EXAMPLE;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="font-brand text-4xl font-extrabold tracking-[-0.025em] text-[#032a1f] sm:text-5xl">Hola, {user.name.split(" ")[0]}</h1>
          <p className="mt-2 text-lg text-[#5b6b65]">
            Así va el costeo de tu restaurante{home.period ? ` en ${home.period.label}` : " este mes"}.
            {!t && <span className="text-sm"> (Cifras de ejemplo hasta completar el plan del mes.)</span>}
          </p>
        </div>
        <Link
          href={next?.href ?? "/app/costos"}
          className="inline-flex min-h-12 items-center rounded-2xl bg-[#006b4b] px-6 text-base font-extrabold text-white transition-colors hover:bg-[#00563d]"
        >
          {next ? `Continuar: ${next.title.toLowerCase()}` : "Ver costo y precio"}
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
          <p className="mt-2 font-brand text-4xl font-extrabold tracking-[-0.02em] text-[#032a1f]">{t ? formatMoney(t.profit, restaurant.currency) : "S/ 3,600"}</p>
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
