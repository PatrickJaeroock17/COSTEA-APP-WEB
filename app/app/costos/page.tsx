import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Tag } from "lucide-react";
import { CreateRestaurant } from "@/components/app/create-restaurant";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { ActivatePlan, CreatePlanForm } from "@/components/app/costos/forms";
import { MoreCostingHint, QuickCosts, type QuickDish } from "@/components/app/costos/quick-costs";
import { PlanStatusBox } from "@/components/app/costos/status";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableEmpty, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canEdit, getAppContext } from "@/lib/auth";
import { D } from "@/lib/costing/decimal";
import { evaluatePlan, getDishOptions, getPlans } from "@/lib/data/plan";
import { getProductSummaries } from "@/lib/data/products";
import { limaToday } from "@/lib/materials";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { periodDates } from "@/lib/materials";
import { PRICING_MODES } from "@/lib/pricing";
import { igvLabel } from "@/lib/restaurants";

export const metadata = { title: "costea — Costo y precio por plato" };

type Props = { searchParams: Promise<{ plan?: string; creado?: string; fc?: string }> };

export default function CostosPage({ searchParams }: Props) {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<div className="h-[480px] animate-pulse rounded-3xl bg-white" aria-busy="true" aria-label="Cargando" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const pct = (d: InstanceType<typeof D> | null) => (d ? `${d.times(100).toDecimalPlaces(1).toFixed()} %` : "—");

async function Content({ searchParams }: Props) {
  const [sp, ctx] = await Promise.all([searchParams, getAppContext()]);
  if (!ctx.restaurant) return <CreateRestaurant name={ctx.user.name.split(" ")[0]} />;
  const r = ctx.restaurant;
  // Niveles 1 y 2: costo rápido por plato, sin plan de producción (solo insumos).
  if (r.costLevel < 3) return <QuickView sp={sp} restaurant={r} />;
  const period = ctx.period;
  const header = (
    <PageHeader
      icon={Tag}
      title="Costo y precio por plato"
      text="Costo completo por porción (materiales, mano de obra, CIF y gastos repartidos con las porciones del mes) y el precio de venta según tu objetivo."
    />
  );
  if (!period) return <>{header}<div className="mt-6"><EmptyState title="Agrega un mes de trabajo" text="Créalo en Configuración." /></div></>;
  const editable = canEdit(r.role);
  const plans = await getPlans(r.id, period.id);
  const plan = plans.find((p) => p.id === Number(sp.plan)) ?? plans.find((p) => p.active) ?? plans[0];

  if (!plan) {
    const dishes = await getDishOptions(r.id, period.id);
    return (
      <>
        {header}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Plan de {period.label}</CardTitle>
            <CardDescription>
              Para repartir la mano de obra y los gastos hace falta saber cuántas porciones de cada plato venderás en el mes. Elige los platos, sus porciones y su precio de carta;
              luego podrás cambiar la modalidad de precio de cada uno.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!dishes.length ? (
              <EmptyState icon={Tag} title="Aún no hay platos con receta" text="Crea o trae platos en Platos y recetas.">
                <Link href="/app/platos" className={buttonVariants({ size: "lg" })}>
                  Ir a Platos y recetas
                </Link>
              </EmptyState>
            ) : editable ? (
              <CreatePlanForm periodId={period.id} periodLabel={period.label} defaultDate={periodDates(period).reference} dishes={dishes} currency={r.currency} />
            ) : (
              <p className="text-muted-foreground">Aún no hay un plan para este mes.</p>
            )}
          </CardContent>
        </Card>
      </>
    );
  }

  const { result, lines } = await evaluatePlan(r.id, plan, { name: r.name, currency: r.currency });
  const lineOf = new Map(lines.map((l) => [l.id, l]));
  const ok = result.status === "calculable";

  return (
    <>
      {header}
      {sp.creado && (
        <p role="status" className="mt-4 rounded-xl bg-success-soft px-4 py-3 text-sm font-semibold text-success-text">
          Plan creado. Revisa el costo de cada plato y ajusta su modalidad de precio.
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          <strong className="text-heading">{plan.name}</strong> · precios de insumos al {formatDate(plan.price_date)} · IGV {igvLabel(r.igvRate)}
          {plans.length > 1 && ` · ${plans.length} planes en ${period.label}`}
        </p>
        <div className="flex flex-wrap gap-2">
          {plans.length > 1 &&
            plans
              .filter((p) => p.id !== plan.id)
              .slice(0, 3)
              .map((p) => (
                <Link key={p.id} href={`/app/costos?plan=${p.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Ver {p.name}
                </Link>
              ))}
          {!plan.active && editable && <ActivatePlan planId={plan.id} />}
        </div>
      </div>
      <div className="mt-4">
        <PlanStatusBox status={result.status} issues={result.issues} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Ventas netas del mes", formatMoney(result.totals.sales, r.currency)],
          ["Costos del mes", formatMoney(result.totals.costs, r.currency)],
          ["Utilidad", ok ? formatMoney(result.totals.profit, r.currency) : "Pendiente"],
          ["Margen", ok ? pct(result.totals.margin) : "Pendiente"],
        ].map(([k, value]) => (
          <Card key={k} size="sm">
            <CardContent>
              <p className="text-sm font-semibold text-muted-foreground">{k}</p>
              <p className="mt-1 font-brand text-2xl font-extrabold tabular-nums text-heading">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Costo por porción y precio</CardTitle>
          <CardDescription>Elige un plato para ver el desglose y cambiar su modalidad de precio.</CardDescription>
        </CardHeader>
        <Table className="min-w-[920px]">
          <TableHeader>
            <TableRow>
              <TableHead>Plato</TableHead>
              <TableHead numeric>Porciones</TableHead>
              <TableHead numeric>Materiales</TableHead>
              <TableHead numeric>Mano de obra</TableHead>
              <TableHead numeric>CIF y gastos</TableHead>
              <TableHead numeric>Costo total</TableHead>
              <TableHead numeric>Precio con IGV</TableHead>
              <TableHead numeric>Margen</TableHead>
              <TableHead className="sr-only">Ver</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((row) => {
              const line = lineOf.get(Number(row.id))!;
              const q = row.quantity;
              const overhead = q.isZero() ? null : row.cif.plus(row.expenses).div(q);
              const mode = PRICING_MODES.find((m) => m.value === line.pricing_mode)?.label;
              return (
                <TableRow key={String(row.id)}>
                  <TableCell>
                    <Link href={`/app/costos/${row.id}`} className="font-bold text-heading hover:underline">
                      {row.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{mode}</span>
                  </TableCell>
                  <TableCell numeric>{formatQty(q)}</TableCell>
                  <TableCell numeric>{formatMoney(row.cmp, r.currency)}</TableCell>
                  <TableCell numeric>{formatMoney(row.mod, r.currency)}</TableCell>
                  <TableCell numeric>{overhead ? formatMoney(overhead, r.currency) : <TableEmpty />}</TableCell>
                  <TableCell numeric className="font-bold">
                    {row.complete ? formatMoney(row.complete, r.currency) : <TableEmpty />}
                  </TableCell>
                  <TableCell numeric className="font-bold text-heading">
                    {row.price ? formatMoney(row.price.final, r.currency) : <TableEmpty />}
                  </TableCell>
                  <TableCell numeric>{row.price ? pct(row.price.margin) : <TableEmpty />}</TableCell>
                  <TableCell>
                    <Link href={`/app/costos/${row.id}`} aria-label={`Ver ${row.name}`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })}>
                      <ChevronRight aria-hidden />
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5}>Costo completo asignado a los platos</TableCell>
              <TableCell numeric>{formatMoney(result.totals.completeAssigned, r.currency)}</TableCell>
              <TableCell colSpan={3} className="text-xs font-semibold text-muted-foreground">
                + mano de obra ociosa {formatMoney(result.totals.idle, r.currency)} y sin base {formatMoney(result.totals.unassigned, r.currency)} = {formatMoney(result.totals.costs, r.currency)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Card>
    </>
  );
}

async function QuickView({ sp, restaurant: r }: { sp: { fc?: string }; restaurant: NonNullable<Awaited<ReturnType<typeof getAppContext>>["restaurant"]> }) {
  const products = (await getProductSummaries(r.id, limaToday())).filter((p) => p.active);
  const dishes: QuickDish[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.menu_category,
    perUnit: p.cost.perUnit ? p.cost.perUnit.toFixed() : null,
    pending: p.cost.pricePending,
    current: p.price,
  }));
  return (
    <>
      <PageHeader icon={Tag} title="Costo y precio por plato" text="Cuánto te cuesta cada plato con sus insumos y a qué precio venderlo." />
      {dishes.length ? (
        <QuickCosts dishes={dishes} money={{ currency: r.currency, igvRate: r.igvRate, igvLabel: igvLabel(r.igvRate) }} initialTarget={sp.fc} />
      ) : (
        <div className="mt-6">
          <EmptyState icon={Tag} title="Aún no tienes platos con receta" text="Trae un plato del catálogo con su receta lista o crea uno propio, y aquí verás su costo y precio.">
            <Link href="/app/platos" className={buttonVariants({ size: "lg" })}>
              Ir a Platos y recetas
            </Link>
          </EmptyState>
        </div>
      )}
      <div className="mt-8">
        <MoreCostingHint />
      </div>
    </>
  );
}
