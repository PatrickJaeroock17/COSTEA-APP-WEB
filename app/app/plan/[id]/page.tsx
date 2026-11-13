import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { ActivatePlan, RemoveLine } from "@/components/app/costos/forms";
import { PlanStatusBox } from "@/components/app/costos/status";
import { AddLineForm, PlanSettingsForm, ReviewPlan } from "@/components/app/plan/forms";
import { PublishBudget } from "@/components/app/presupuestos/forms";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableEmpty, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canEdit, getAppContext } from "@/lib/auth";
import { D } from "@/lib/costing/decimal";
import { overheadTables, productionTable } from "@/lib/costing/reports";
import { getConcepts } from "@/lib/data/expenses";
import { evaluatePlan, getPlan } from "@/lib/data/plan";
import { formatMoney, formatQty } from "@/lib/format";
import { fieldClass } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "costea — Plan" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ plato?: string }> };

export default function PlanDetailPage(props: Props) {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<div className="h-[600px] animate-pulse rounded-3xl bg-white" aria-busy="true" aria-label="Cargando" />}>
        <Detail {...props} />
      </Suspense>
    </div>
  );
}

const pct = (d: InstanceType<typeof D> | null) => (d ? `${d.times(100).toDecimalPlaces(1).toFixed()} %` : "—");

async function Detail({ params, searchParams }: Props) {
  const [{ id }, sp, ctx] = await Promise.all([params, searchParams, getAppContext()]);
  const r = ctx.restaurant;
  const planId = Number(id);
  if (!r || !Number.isInteger(planId) || planId <= 0) notFound();
  const plan = await getPlan(r.id, planId);
  if (!plan) notFound();
  const supabase = await createClient();
  const [{ result, fingerprint, lines }, concepts, { data: products }, { data: prices }, { data: budgetData }] = await Promise.all([
    evaluatePlan(r.id, plan, { name: r.name, currency: r.currency }),
    getConcepts(r.id, plan.period_id),
    supabase.from("products").select("id, name").eq("restaurant_id", r.id).eq("active", true).order("name"),
    supabase.from("product_prices").select("product_id, amount::text").eq("restaurant_id", r.id),
    supabase.from("budgets").select("id, number, fingerprint").eq("plan_id", planId).order("number", { ascending: false }),
  ]);
  const budgets = (budgetData ?? []) as { id: number; number: number; fingerprint: string }[];
  const editable = canEdit(r.role);
  const period = ctx.periods.find((p) => p.id === plan.period_id);
  const fresh = plan.calculation_hash === fingerprint;
  const production = productionTable(result);
  const lineOf = new Map(lines.map((l) => [l.id, l]));
  const inPlan = new Set(lines.map((l) => l.product_id));
  const priceOf = new Map(((prices ?? []) as unknown as { product_id: number; amount: string }[]).map((p) => [p.product_id, p.amount]));

  // CIF y gastos de un plato del plan (legacy: overhead_tables con la línea elegida).
  const selected = result.rows.find((x) => Number(x.id) === Number(sp.plato)) ?? result.rows[0];
  const groups = selected
    ? overheadTables(
        concepts.map((c) => ({ id: c.id, name: c.name, kind: c.kind, amount: c.amount, active: c.active, basis: c.basis })),
        { allocations: result.allocations },
        { id: Number(selected.id), quantity: selected.quantity.toFixed() },
      )
    : [];

  return (
    <>
      <Link href="/app/plan" className={buttonVariants({ variant: "link" })}>
        <ArrowLeft aria-hidden />
        Plan de producción
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-brand text-3xl font-extrabold tracking-[-0.02em] text-heading sm:text-4xl">{plan.name}</h1>
          <p className="mt-1 text-muted-foreground">
            {period?.label} · {plan.active ? "Plan activo del mes" : "Escenario"}
          </p>
        </div>
        {editable && (
          <div className="flex flex-wrap gap-2">
            {!plan.active && <ActivatePlan planId={plan.id} />}
            <ReviewPlan planId={plan.id} fresh={fresh} />
          </div>
        )}
      </div>

      <div className="mt-4 space-y-3">
        <PlanStatusBox status={result.status} issues={result.issues} />
        {fresh && (
          <p className="flex items-center gap-2 rounded-2xl bg-info-soft px-4 py-3 text-sm font-semibold text-info-text">
            <CheckCircle2 className="size-4" aria-hidden />
            Cálculo revisado con las entradas actuales. Si cambias recetas, precios, personal o gastos, vuelve a revisarlo.
          </p>
        )}
      </div>

      {editable && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Presupuesto</CardTitle>
            <CardDescription>
              {budgets.length
                ? `Este plan tiene ${budgets.length === 1 ? "1 presupuesto publicado" : `${budgets.length} presupuestos publicados`}. Si cambiaste algo, publica una versión nueva.`
                : "Publica el plan para guardar su presupuesto fijo del mes."}
              {budgets.length > 0 && (
                <>
                  {" "}
                  <Link href={`/app/presupuestos/${budgets[0].id}`} className="font-bold text-primary hover:underline">
                    Ver la versión {budgets[0].number}
                  </Link>
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PublishBudget
              planId={plan.id}
              fingerprint={fingerprint}
              blocked={
                result.status !== "calculable"
                  ? "Resuelve los pendientes del cálculo antes de publicar."
                  : !fresh
                    ? "Pulsa «Revisar cálculo» antes de publicar, para confirmar las entradas actuales."
                    : budgets[0]?.fingerprint === fingerprint
                      ? "Ya está publicado con estas mismas entradas."
                      : null
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Producción y ventas (legacy: production_table) */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Producción y ventas netas</CardTitle>
          <CardDescription>Producción igual a ventas; sin inventarios ni productos en proceso.</CardDescription>
        </CardHeader>
        <Table className="min-w-[860px]">
          <TableHeader>
            <TableRow>
              <TableHead>Plato</TableHead>
              <TableHead numeric>Porciones</TableHead>
              <TableHead numeric>Participación</TableHead>
              <TableHead numeric>Precio neto</TableHead>
              <TableHead numeric>Ventas netas</TableHead>
              <TableHead numeric>% ventas</TableHead>
              <TableHead numeric>Costo total</TableHead>
              {editable && <TableHead className="sr-only">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {production.rows.map((row, i) => {
              const id = Number(result.rows[i].id);
              return (
                <TableRow key={id}>
                  <TableCell>
                    <Link href={`/app/costos/${id}`} className="font-bold text-heading hover:underline">
                      {row.name}
                    </Link>
                    {lineOf.get(id) && lineOf.get(id)!.recipeNumber < lineOf.get(id)!.latestNumber && (
                      <span className="block text-xs font-semibold text-warning-text">Usa la versión {lineOf.get(id)!.recipeNumber}; hay una más reciente</span>
                    )}
                  </TableCell>
                  <TableCell numeric>{formatQty(row.quantity)}</TableCell>
                  <TableCell numeric>{pct(row.share)}</TableCell>
                  <TableCell numeric>{row.net ? formatMoney(row.net, r.currency) : <TableEmpty />}</TableCell>
                  <TableCell numeric>{row.sales ? formatMoney(row.sales, r.currency) : <TableEmpty />}</TableCell>
                  <TableCell numeric>{pct(row.salesShare)}</TableCell>
                  <TableCell numeric>{row.totalCost ? formatMoney(row.totalCost, r.currency) : <TableEmpty />}</TableCell>
                  {editable && (
                    <TableCell>
                      <RemoveLine lineId={id} back={`/app/plan/${plan.id}`} />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Total</TableCell>
              <TableCell numeric>{production.quantity ? formatQty(production.quantity) : "—"}</TableCell>
              <TableCell />
              <TableCell />
              <TableCell numeric>{production.sales ? formatMoney(production.sales, r.currency) : "—"}</TableCell>
              <TableCell />
              <TableCell numeric>{production.cost ? formatMoney(production.cost, r.currency) : "—"}</TableCell>
              {editable && <TableCell />}
            </TableRow>
          </TableFooter>
        </Table>
        {editable && (
          <CardContent className="border-t border-line pt-5">
            <AddLineForm
              planId={plan.id}
              currency={r.currency}
              products={((products ?? []) as { id: number; name: string }[]).filter((p) => !inPlan.has(p.id)).map((p) => ({ ...p, price: priceOf.get(p.id) ?? "" }))}
            />
          </CardContent>
        )}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Capacidad del personal (legacy: excess, idle, required_units) */}
        <Card>
          <CardHeader>
            <CardTitle>Capacidad del personal</CardTitle>
            <CardDescription>Minutos que pide el plan frente a los minutos MOD efectivos del mes. Lo no usado queda como mano de obra ociosa.</CardDescription>
          </CardHeader>
          <Table className="min-w-[520px]">
            <TableHeader>
              <TableRow>
                <TableHead>Trabajador</TableHead>
                <TableHead numeric>Requerido</TableHead>
                <TableHead numeric>Disponible</TableHead>
                <TableHead numeric>Ociosa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.staff.map((s) => {
                const byQty = s.directBasis === "quantity";
                const over = s.excess.gt(0) || s.excessUnits.gt(0);
                return (
                  <TableRow key={String(s.id)} className={cn(over && "bg-danger-soft/60")}>
                    <TableCell>
                      <span className="font-bold text-heading">{s.name}</span>
                      {over && <span className="block text-xs font-semibold text-danger-text">Capacidad excedida</span>}
                    </TableCell>
                    <TableCell numeric>{byQty ? `${formatQty(s.requiredUnits)} porc.` : `${formatQty(s.required, 2)} min`}</TableCell>
                    <TableCell numeric>{byQty ? `${formatQty(s.plannedUnits)} porc.` : `${formatQty(s.minutes, 2)} min`}</TableCell>
                    <TableCell numeric>{formatMoney(s.idle, r.currency)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {!result.staff.length && <CardContent className="text-sm text-muted-foreground">Sin costos de personal en el mes.</CardContent>}
        </Card>

        {/* Requerimiento de insumos (legacy: requirements) */}
        <Card>
          <CardHeader>
            <CardTitle>Insumos necesarios</CardTitle>
            <CardDescription>Cantidad bruta del mes en la unidad base de cada insumo, incluida la merma.</CardDescription>
          </CardHeader>
          <Table className="min-w-[440px]">
            <TableHeader>
              <TableRow>
                <TableHead>Insumo</TableHead>
                <TableHead numeric>Cantidad</TableHead>
                <TableHead numeric>Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.requirements.map((q) => (
                <TableRow key={String(q.materialId)}>
                  <TableCell>
                    <Link href={`/app/insumos/${q.materialId}`} className="font-bold text-heading hover:underline">
                      {q.name}
                    </Link>
                  </TableCell>
                  <TableCell numeric>
                    {formatQty(q.quantity)} {q.unit}
                  </TableCell>
                  <TableCell numeric>{formatMoney(q.amount, r.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Materia prima del mes</TableCell>
                <TableCell numeric>{formatMoney(result.totals.cmp, r.currency)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Card>
      </div>

      {/* CIF y gastos por plato (legacy: concepts_tables) */}
      {selected && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>CIF y gastos de un plato</CardTitle>
            <CardDescription>Porcentaje de la base de cada concepto, monto asignado en el mes y costo por porción.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="block flex-1 text-sm font-bold text-ink">
                Plato
                <select name="plato" defaultValue={String(selected.id)} className={cn(fieldClass, "mt-1.5 h-12")}>
                  {result.rows.map((x) => (
                    <option key={String(x.id)} value={String(x.id)}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className={buttonVariants({ size: "lg" })}>
                Ver
              </button>
            </form>
          </CardContent>
          {groups
            .filter((g) => g.rows.length)
            .map((g) => (
              <div key={g.kind} className="border-t border-line">
                <p className="px-5 pt-4 text-sm font-extrabold text-heading sm:px-6">{g.title.charAt(0) + g.title.slice(1).toLowerCase()}</p>
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Concepto</TableHead>
                      <TableHead numeric>Mensual</TableHead>
                      <TableHead numeric>% de la base</TableHead>
                      <TableHead numeric>Asignado</TableHead>
                      <TableHead numeric>Por porción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.rows.map((row) => (
                      <TableRow key={row.key} className={cn(!row.active && "text-muted-foreground")}>
                        <TableCell>
                          {row.name}
                          {!row.active && " (excluido)"}
                        </TableCell>
                        <TableCell numeric>{formatMoney(row.amount, r.currency)}</TableCell>
                        <TableCell numeric>{row.percent ? pct(row.percent) : <TableEmpty />}</TableCell>
                        <TableCell numeric>{row.assigned ? formatMoney(row.assigned, r.currency) : <TableEmpty />}</TableCell>
                        <TableCell numeric>{row.unitCost ? formatMoney(row.unitCost, r.currency, 4) : <TableEmpty />}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4}>Total por porción</TableCell>
                      <TableCell numeric>{g.total ? formatMoney(g.total, r.currency, 4) : "Pendiente"}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            ))}
        </Card>
      )}

      {editable && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Datos del plan</CardTitle>
          </CardHeader>
          <CardContent>
            <PlanSettingsForm plan={plan} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
