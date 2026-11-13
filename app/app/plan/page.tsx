import Link from "next/link";
import { Suspense } from "react";
import { CalendarClock, ChevronRight } from "lucide-react";
import { CreateRestaurant } from "@/components/app/create-restaurant";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { CreatePlanForm } from "@/components/app/costos/forms";
import { STATUS_LABEL } from "@/components/app/costos/status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canEdit, getAppContext } from "@/lib/auth";
import { productionTable } from "@/lib/costing/reports";
import { evaluatePlan, getDishOptions, getPlans } from "@/lib/data/plan";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { periodDates } from "@/lib/materials";
import { cn } from "@/lib/utils";

export const metadata = { title: "costea — Plan de producción" };

export default function PlanPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<div className="h-[480px] animate-pulse rounded-3xl bg-white" aria-busy="true" aria-label="Cargando" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await getAppContext();
  if (!ctx.restaurant) return <CreateRestaurant name={ctx.user.name.split(" ")[0]} />;
  const r = ctx.restaurant;
  const period = ctx.period;
  const header = (
    <PageHeader
      icon={CalendarClock}
      title="Plan de producción"
      text="Cuántas porciones de cada plato producirás y venderás en el mes, qué insumos necesitas y si el personal alcanza. Puedes comparar varios escenarios; el activo alimenta Costo y precio."
    />
  );
  if (!period) return <>{header}<div className="mt-6"><EmptyState title="Agrega un mes de trabajo" text="Créalo en Configuración." /></div></>;
  const editable = canEdit(r.role);
  const [plans, dishes] = await Promise.all([getPlans(r.id, period.id), editable ? getDishOptions(r.id, period.id) : Promise.resolve([])]);
  const evaluations = await Promise.all(plans.map((p) => evaluatePlan(r.id, p, { name: r.name, currency: r.currency })));

  return (
    <>
      {header}
      {plans.length > 0 && (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {evaluations.map(({ plan, result, fingerprint }) => {
            const table = productionTable(result);
            const ok = result.status === "calculable";
            return (
              <li key={plan.id}>
                <Link href={`/app/plan/${plan.id}`} className="block h-full rounded-3xl border border-line bg-card p-5 transition-shadow hover:shadow-lift sm:p-6">
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block font-heading text-lg font-extrabold text-heading">{plan.name}</span>
                      <span className="block text-sm text-muted-foreground">Precios al {formatDate(plan.price_date)}</span>
                    </span>
                    <ChevronRight className="mt-1 size-5 text-subtle" aria-hidden />
                  </span>
                  <span className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                    {plan.active && <span className="rounded-full bg-brand-100 px-2.5 py-1 text-brand-700">Activo</span>}
                    <span className={cn("rounded-full px-2.5 py-1", ok ? "bg-success-soft text-success-text" : "bg-warning-soft text-warning-text")}>{STATUS_LABEL[result.status]}</span>
                    {plan.calculation_hash === fingerprint && <span className="rounded-full bg-info-soft px-2.5 py-1 text-info-text">Revisado</span>}
                  </span>
                  <span className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    {[
                      ["Porciones", table.quantity ? formatQty(table.quantity) : "—"],
                      ["Ventas netas", table.sales ? formatMoney(table.sales, r.currency) : "—"],
                      ["Utilidad", ok ? formatMoney(result.totals.profit, r.currency) : "Pendiente"],
                    ].map(([k, v]) => (
                      <span key={k}>
                        <span className="block text-xs text-muted-foreground">{k}</span>
                        <span className="font-bold tabular-nums text-heading">{v}</span>
                      </span>
                    ))}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {editable && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{plans.length ? "Nuevo escenario" : `Plan de ${period.label}`}</CardTitle>
            <CardDescription>
              Cada escenario es independiente: las recetas entran con su versión y conservan sus precios. {plans.length ? "Actívalo cuando quieras que alimente Costo y precio." : "El primero queda activo."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dishes.length ? (
              <CreatePlanForm
                periodId={period.id}
                periodLabel={plans.length ? `${period.label} · escenario ${plans.length + 1}` : period.label}
                defaultDate={periodDates(period).reference}
                dishes={dishes}
                currency={r.currency}
                next="plan"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Primero crea o trae platos en Platos y recetas.</p>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
