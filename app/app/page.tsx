import Link from "next/link";
import { Suspense } from "react";
import { CreateRestaurant } from "@/components/app/create-restaurant";
import { getAppContext } from "@/lib/auth";
import { D } from "@/lib/costing/decimal";
import type { CostLevel } from "@/lib/cost-level";
import { type HomeSummary, getHomeSummary } from "@/lib/data/home";
import { formatMoney } from "@/lib/format";
import { AlertTriangle, Check, Lock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ValueTicker } from "@/components/motion/value-ticker";
import { cn } from "@/lib/utils";
import { isVisibleAt } from "@/lib/cost-level";

// Caso de comprobación de GUIA_RAPIDA.md: se muestra como ejemplo mientras el mes no tiene un plan con cálculo completo.
const EXAMPLE = [
  { label: "Ventas netas del mes", value: "S/ 12,000", note: "Sin IGV · ejemplo" },
  { label: "Costo completo por unidad", value: "S/ 10.00", note: "Producción + gastos asignados" },
  { label: "Margen operativo", value: "30 %", note: "Sobre la venta neta" },
];

type Step = { title: string; text: string; state: "done" | "current" | "locked"; href: string; n?: number };
type Alert = { tone: "warn" | "ok"; title: string; text: string };

const card = "rounded-3xl border border-line bg-card";

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
function buildSteps(h: HomeSummary, currency: string, level: CostLevel): Step[] {
  const raw: Omit<Step, "state" | "n">[] = [];
  const doneFlags: boolean[] = [];
  const add = (title: string, href: string, done: boolean, text: string) => {
    if (!isVisibleAt(href, level)) return; // Solo los pasos de los módulos del nivel de costeo.
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
    level < 3 ? h.dishes.withRecipe > 0 && h.materials.priced > 0 : h.calculable,
    level < 3
      ? h.dishes.withRecipe > 0
        ? "Costo por porción y precio de carta de tus platos"
        : "Se calcula cuando tu plato tiene receta"
      : h.calculable
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
function buildAlerts(h: HomeSummary, level: CostLevel): Alert[] {
  const alerts: Alert[] = [];
  if (level === 3 && h.period && !h.expenses.salesExpense && !h.expenses.noExpensesDeclared) {
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
  if (level === 3 && h.plan && h.plan.status !== "calculable") {
    alerts.push({ tone: "warn", title: "El plan del mes tiene pendientes", text: h.plan.issues.slice(0, 2).join(" ") || "Revisa el plan de producción." });
  }
  if (level >= 2 && h.staff.active) {
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
  const level = restaurant.costLevel;
  const steps = buildSteps(home, restaurant.currency, level);
  const done = steps.filter((s) => s.state === "done").length;
  const alerts = buildAlerts(home, level);
  const showAlerts = level === 3 || alerts.length > 0;
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
          <h1 className="font-brand text-4xl font-extrabold tracking-display text-heading sm:text-5xl">Hola, {user.name.split(" ")[0]}</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Así va el costeo de tu restaurante{home.period ? ` en ${home.period.label}` : " este mes"}.
            {!t && level === 3 && <span className="text-sm"> (Cifras de ejemplo hasta completar el plan del mes.)</span>}
          </p>
        </div>
        <Link
          href={next?.href ?? "/app/costos"}
          className={cn(buttonVariants({ size: "lg" }), "h-auto min-h-12 whitespace-normal text-base")}
        >
          {next ? `Continuar: ${next.title.toLowerCase()}` : "Ver costo y precio"}
        </Link>
      </div>

      {level < 3 && home.dishes.withRecipe === 0 && (
        <section className="enter-up mt-8 rounded-3xl border border-brand-600/30 bg-brand-50 p-6 sm:p-8" aria-labelledby="empieza">
          <h2 id="empieza" className="font-brand text-2xl font-extrabold text-heading sm:text-3xl">Tu primer costo en 3 pasos</h2>
          <p className="mt-2 max-w-2xl text-lg text-ink-soft">
            Elige un plato de ejemplo, escribe su precio y mira cuánto te cuesta. Toma menos de 5 minutos y no necesitas saber de contabilidad.
          </p>
          <Link href="/app/empezar" className={cn(buttonVariants({ size: "lg" }), "mt-6 h-auto min-h-14 whitespace-normal px-8 py-3 text-lg")}>
            Empezar ahora
          </Link>
        </section>
      )}

      {level === 3 && (
      <div className="cascade mt-8 grid gap-4 md:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className={cn(card, "p-6")}>
            <p className="text-body font-medium text-muted-foreground">{k.label}</p>
            <p className="mt-2 font-brand text-4xl font-extrabold tracking-title text-heading"><ValueTicker id={`inicio-${k.label}`} text={k.value} /></p>
            <p className="mt-1.5 text-sm text-muted-foreground">{k.note}</p>
          </div>
        ))}
        <div className={cn(card, "p-6 md:col-span-3")}>
          <p className="text-body font-medium text-muted-foreground">Utilidad estimada</p>
          <p className="mt-2 font-brand text-4xl font-extrabold tracking-title text-heading"><ValueTicker id="inicio-utilidad" text={t ? formatMoney(t.profit, restaurant.currency) : "S/ 3,600"} /></p>
          <p className="mt-1.5 text-sm text-muted-foreground">Ventas menos costos del mes</p>
        </div>
      </div>
      )}

      <div className={cn("cascade grid gap-6 lg:items-start", showAlerts && "lg:grid-cols-[1.5fr_1fr]", level === 3 ? "mt-6" : "mt-8")}>
        <section className={cn(card, "p-6 sm:p-7")} aria-labelledby="config">
          <div className="flex items-center justify-between gap-4">
            <h2 id="config" className="font-brand text-2xl font-extrabold text-heading">{level === 3 ? "Configura tu restaurante" : "Tu primer costo, paso a paso"}</h2>
            <span className="text-sm font-bold text-primary">{done} de {steps.length} listos</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done}>
            <div className="bar-slide h-full w-full rounded-full bg-primary" style={{ transform: `translateX(${-100 + (done / steps.length) * 100}%)` }} />
          </div>
          <ul className="mt-2 divide-y divide-line">
            {steps.map((s) => (
              <li key={s.title} className="flex items-center gap-4 py-4">
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full font-brand font-extrabold",
                    s.state === "done" && "bg-brand-100 text-brand-600",
                    s.state === "current" && "bg-lime-500 text-brand-900",
                    s.state === "locked" && "bg-line-soft text-subtle",
                  )}
                >
                  {s.state === "done" ? <Check className="size-5" strokeWidth={2.5} aria-hidden /> : s.state === "locked" ? <Lock className="size-4" aria-hidden /> : s.n}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block font-bold", s.state === "locked" ? "text-muted-foreground" : "text-heading")}>{s.title}</span>
                  <span className="block text-sm text-muted-foreground">{s.text}</span>
                </span>
                {s.state === "done" && <Link href={s.href} className={cn(buttonVariants({ variant: "link" }), "text-sm")}>Ver</Link>}
                {s.state === "current" && (
                  <Link href={s.href} className={cn(buttonVariants(), "px-5 text-sm")}>Completar</Link>
                )}
                {s.state === "locked" && <span className="text-sm text-muted-foreground">Pendiente</span>}
              </li>
            ))}
          </ul>
        </section>

        {showAlerts && (
        <section className={cn(card, "p-6 sm:p-7")} aria-labelledby="atencion">
          <h2 id="atencion" className="font-brand text-2xl font-extrabold text-heading">Requiere tu atención</h2>
          <ul className="mt-5 space-y-3">
            {alerts.map((a) => (
              <li key={a.title} className={cn("flex gap-3 rounded-2xl p-4", a.tone === "warn" ? "bg-warning-soft" : "bg-success-soft")}>
                {a.tone === "warn" ? (
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
                ) : (
                  <Check className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={2.5} aria-hidden />
                )}
                <span>
                  <span className="block font-bold text-heading">{a.title}</span>
                  <span className="block text-sm leading-relaxed text-ink-soft">{a.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        )}
      </div>
    </div>
  );
}
