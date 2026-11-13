import Link from "next/link";
import { Suspense } from "react";
import { BarChart3, CheckCircle2, Info } from "lucide-react";
import { CreateRestaurant } from "@/components/app/create-restaurant";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { PlanStatusBox } from "@/components/app/costos/status";
import { PrintButton } from "@/components/app/reportes/print-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableEmpty, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAppContext } from "@/lib/auth";
import { D, type Dec } from "@/lib/costing/decimal";
import { type BudgetSnapshot, getBudget } from "@/lib/data/budgets";
import { evaluatePlan, getMonthPlanEvaluation, getPlans } from "@/lib/data/plan";
import { getMonthlyResults } from "@/lib/data/sales";
import { BASES } from "@/lib/expenses";
import { formatMoney, formatQty } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "costea — Reportes" };

type Props = { searchParams: Promise<{ plan?: string }> };

export default function ReportesPage({ searchParams }: Props) {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<div className="h-[600px] animate-pulse rounded-3xl bg-white" aria-busy="true" aria-label="Cargando" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const pct = (d: Dec | string | null | undefined) => (d ? `${new D(d).times(100).toDecimalPlaces(1).toFixed()} %` : "—");
const BASIS_LABEL = Object.fromEntries(BASES.map((b) => [b.value, b.label]));

function Section({ title, text, children }: { title: string; text?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="mt-6 break-inside-avoid">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {text && <CardDescription>{text}</CardDescription>}
      </CardHeader>
      {children}
    </Card>
  );
}

async function Content({ searchParams }: Props) {
  const [sp, ctx] = await Promise.all([searchParams, getAppContext()]);
  if (!ctx.restaurant) return <CreateRestaurant name={ctx.user.name.split(" ")[0]} />;
  const r = ctx.restaurant;
  const period = ctx.period;
  const cur = r.currency;
  const header = (
    <PageHeader icon={BarChart3} title="Reportes" text="Reporte del plan del mes: costos y precios, origen de cada costo, personal, distribución de gastos, conciliación e insumos.">
      <PrintButton />
    </PageHeader>
  );
  if (!period) return <>{header}<div className="mt-6"><EmptyState title="Agrega un mes de trabajo" text="Créalo en Configuración." /></div></>;

  // Mismo plan que Costo y precio (activo o el más reciente); se puede elegir otro escenario del mes.
  const plans = await getPlans(r.id, period.id);
  const chosen = plans.find((p) => p.id === Number(sp.plan));
  const evaluation = chosen ? await evaluatePlan(r.id, chosen, { name: r.name, currency: cur }) : await getMonthPlanEvaluation(r.id, period.id, r.name, cur);
  if (!evaluation) {
    return (
      <>
        {header}
        <div className="mt-6">
          <EmptyState title={`Sin plan en ${period.label}`} text="Crea el plan del mes en Costo y precio o en Plan de producción para ver el reporte.">
            <Link href="/app/plan" className={buttonVariants({ size: "lg" })}>
              Ir a Plan de producción
            </Link>
          </EmptyState>
        </div>
      </>
    );
  }
  const { plan, result, fingerprint } = evaluation;
  const t = result.totals;
  const fresh = plan.calculation_hash === fingerprint;
  const ok = result.status === "calculable";
  const rowName = new Map(result.rows.map((x) => [String(x.id), x.name]));

  // Real vs presupuesto: último presupuesto publicado del plan frente a las ventas registradas del mes.
  const supabase = await createClient();
  const [{ data: lastBudget }, actual] = await Promise.all([
    supabase.from("budgets").select("id").eq("plan_id", plan.id).order("number", { ascending: false }).limit(1).maybeSingle(),
    getMonthlyResults(r.id, period),
  ]);
  const budget = lastBudget ? await getBudget(r.id, lastBudget.id) : null;
  const snap: BudgetSnapshot | null = budget?.snapshot ?? null;

  return (
    <>
      {header}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          <strong className="text-heading">{plan.name}</strong> · {period.label} · {fresh ? "Cálculo revisado" : "Vista previa: revisa el cálculo en el plan"}. No se suman otros escenarios.
        </p>
        {plans.length > 1 && (
          <form className="flex gap-2 print:hidden">
            <select name="plan" defaultValue={String(plan.id)} aria-label="Plan del reporte" className="h-10 rounded-xl border border-transparent bg-field px-3 text-sm text-ink">
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.active ? " (activo)" : ""}
                </option>
              ))}
            </select>
            <button type="submit" className={buttonVariants({ variant: "outline" })}>
              Ver
            </button>
          </form>
        )}
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-2xl bg-info-soft px-4 py-3 text-sm text-info-text">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        Producción igual a ventas; sin inventarios ni productos en proceso. Costo completo gerencial para fijar precios; no es una valoración contable de inventarios. Moneda: {cur}.
      </p>
      {!ok && (
        <div className="mt-4">
          <PlanStatusBox status={result.status} issues={result.issues} />
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Ventas netas estimadas", formatMoney(t.sales, cur)],
          ["Costos del periodo", formatMoney(t.costs, cur)],
          ["Resultado antes de impuesto a la renta", ok ? formatMoney(t.profit, cur) : "Pendiente"],
          ["Mano de obra no absorbida", formatMoney(t.idle, cur)],
        ].map(([k, v]) => (
          <Card key={k} size="sm">
            <CardContent>
              <p className="text-sm font-semibold text-muted-foreground">{k}</p>
              <p className="mt-1 font-brand text-2xl font-extrabold tabular-nums text-heading">{v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Section title="Cuadro de costos y precios" text="Por porción; CIF y gastos como totales asignados en el mes. Precios redondeados a céntimos; las sumas usan precisión completa.">
        <Table className="min-w-[1100px]">
          <TableHeader>
            <TableRow>
              <TableHead>Plato</TableHead>
              <TableHead numeric>Porciones</TableHead>
              <TableHead numeric>Materia prima / u</TableHead>
              <TableHead numeric>MOD / u</TableHead>
              <TableHead numeric>CIF total</TableHead>
              <TableHead numeric>Gastos total</TableHead>
              <TableHead numeric>Producción / u</TableHead>
              <TableHead numeric>Costo total / u</TableHead>
              <TableHead numeric>Venta neta / u</TableHead>
              <TableHead numeric>IGV / u</TableHead>
              <TableHead numeric>Precio final</TableHead>
              <TableHead numeric>Margen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((row) => (
              <TableRow key={String(row.id)}>
                <TableCell className="font-bold text-heading">{row.name}</TableCell>
                <TableCell numeric>{formatQty(row.quantity)}</TableCell>
                <TableCell numeric>{formatMoney(row.cmp, cur)}</TableCell>
                <TableCell numeric>{formatMoney(row.mod, cur)}</TableCell>
                <TableCell numeric>{formatMoney(row.cif, cur)}</TableCell>
                <TableCell numeric>{formatMoney(row.expenses, cur)}</TableCell>
                <TableCell numeric>{row.production ? formatMoney(row.production, cur) : <TableEmpty />}</TableCell>
                <TableCell numeric className="font-bold">
                  {row.complete ? formatMoney(row.complete, cur) : <TableEmpty />}
                </TableCell>
                <TableCell numeric>{row.price ? formatMoney(row.price.net, cur) : <TableEmpty />}</TableCell>
                <TableCell numeric>{row.price ? formatMoney(row.price.tax, cur) : <TableEmpty />}</TableCell>
                <TableCell numeric className="font-bold text-heading">
                  {row.price ? formatMoney(row.price.final, cur) : <TableEmpty />}
                </TableCell>
                <TableCell numeric>{row.price ? pct(row.price.margin) : <TableEmpty />}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="Origen de los costos por plato" text="Materiales del lote con su precio y versión, y trabajo por porción.">
        <CardContent className="space-y-3">
          {result.rows.map((row) => (
            <details key={String(row.id)} className="group rounded-2xl bg-surface p-4 open:bg-white open:ring-1 open:ring-line">
              <summary className="cursor-pointer list-none font-bold text-heading">
                {row.name} <span className="font-normal text-muted-foreground">· materiales y operaciones</span>
              </summary>
              <div className="mt-3 grid gap-4 text-sm lg:grid-cols-2">
                <div>
                  <p className="text-xs font-extrabold tracking-[0.06em] text-muted-foreground uppercase">Materiales del lote</p>
                  <ul className="mt-2 space-y-1.5">
                    {row.materialDetails.map((m, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span>
                          {m.name}
                          <span className="block text-xs text-muted-foreground">
                            {m.origin} · {formatMoney(m.unitCost, cur, 4)} · versión #{String(m.version)} · bruto {formatQty(m.gross, 4)}
                          </span>
                        </span>
                        <span className="tabular-nums">{formatMoney(m.amount, cur, 4)}</span>
                      </li>
                    ))}
                    {!row.materialDetails.length && <li className="text-muted-foreground">Sin líneas de materiales.</li>}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-extrabold tracking-[0.06em] text-muted-foreground uppercase">Trabajo por porción</p>
                  <ul className="mt-2 space-y-1.5">
                    {row.laborDetails.map((l, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span>
                          {l.name} · {l.activity}
                          <span className="block text-xs text-muted-foreground">
                            {l.byQuantity ? "Por porción" : `${formatQty(l.minutes, 4)} min × ${formatMoney(l.rate, cur, 4)}`}
                          </span>
                        </span>
                        <span className="tabular-nums">{formatMoney(l.amount, cur, 4)}</span>
                      </li>
                    ))}
                    {!row.laborDetails.length && <li className="text-muted-foreground">Sin operaciones calculadas.</li>}
                  </ul>
                  {row.price && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Sugerido antes de redondear {formatMoney(row.price.suggested, cur, 4)} · resultado por porción {formatMoney(row.price.result, cur)} · recargo {pct(row.price.markup)} ·
                      costo / venta neta {pct(row.price.costRatio)}
                    </p>
                  )}
                </div>
              </div>
            </details>
          ))}
        </CardContent>
      </Section>

      <Section title="Capacidad y conciliación del personal">
        <Table className="min-w-[960px]">
          <TableHeader>
            <TableRow>
              <TableHead>Trabajador</TableHead>
              <TableHead>Base directa</TableHead>
              <TableHead numeric>Porciones previstas / requeridas</TableHead>
              <TableHead numeric>Min. disponibles</TableHead>
              <TableHead numeric>Min. requeridos</TableHead>
              <TableHead numeric>Exceso</TableHead>
              <TableHead numeric>MOD disponible</TableHead>
              <TableHead numeric>MOD asignada</TableHead>
              <TableHead numeric>No absorbida</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.staff.map((s) => (
              <TableRow key={String(s.id)} className={cn((s.excess.gt(0) || s.excessUnits.gt(0)) && "bg-danger-soft/60")}>
                <TableCell className="font-bold text-heading">{s.name}</TableCell>
                <TableCell>{s.directBasis === "quantity" ? "Porciones" : "Tiempo"}</TableCell>
                <TableCell numeric>
                  {formatQty(s.plannedUnits)} / {formatQty(s.requiredUnits)}
                </TableCell>
                <TableCell numeric>{formatQty(s.minutes, 2)}</TableCell>
                <TableCell numeric>{formatQty(s.required, 2)}</TableCell>
                <TableCell numeric>{formatQty(s.excess, 2)}</TableCell>
                <TableCell numeric>{formatMoney(s.cost, cur)}</TableCell>
                <TableCell numeric>{formatMoney(s.assigned, cur)}</TableCell>
                <TableCell numeric>{formatMoney(s.idle, cur)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!result.staff.length && <CardContent className="text-sm text-muted-foreground">Sin personal configurado en este mes.</CardContent>}
      </Section>

      <Section title="Distribución de CIF y gastos" text="Cada concepto se reparte con su base; el residuo de precisión va a la mayor base y los céntimos cuadran con el importe.">
        <CardContent className="space-y-4">
          {result.allocations.map((c) => (
            <div key={c.id} className="rounded-2xl border border-line">
              <p className="px-4 pt-3 text-sm font-bold text-heading">
                {c.name} · {formatMoney(c.amount, cur)}
                {!c.unassigned.isZero() && <span className="text-warning-text"> · sin asignar {formatMoney(c.unassigned, cur)}</span>}
              </p>
              <p className="px-4 text-xs text-muted-foreground">
                {BASIS_LABEL[c.basis] ?? c.basis}
                {c.justification ? ` · ${c.justification}` : ""}
              </p>
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Plato</TableHead>
                    <TableHead numeric>Base</TableHead>
                    <TableHead numeric>Asignado exacto</TableHead>
                    <TableHead numeric>En céntimos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...c.exact].map(([key, amount]) => (
                    <TableRow key={String(key)}>
                      <TableCell>{rowName.get(String(key))}</TableCell>
                      <TableCell numeric>{formatQty(c.bases.get(key) ?? 0, 4)}</TableCell>
                      <TableCell numeric>{formatMoney(amount, cur, 4)}</TableCell>
                      <TableCell numeric>{formatMoney(c.rounded.get(key) ?? 0, cur)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
          {!result.allocations.length && <p className="text-sm text-muted-foreground">Sin conceptos de distribución.</p>}
        </CardContent>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Conciliación del periodo" text="Utilidad = ventas sin IGV − materiales − MOD disponible − CIF − gastos. La MOD ociosa es costo del periodo; la nómina no se resta dos veces.">
          <Table>
            <TableBody>
              {(
                [
                  ["Materiales totales", t.cmp],
                  ["MOD disponible total", t.modAvailable],
                  ["MOD asignada (incluida en la disponible)", t.modAssigned],
                  ["CIF totales", t.cif],
                  ["Gastos financieros (incluidos en los gastos)", t.finance],
                  ["Gastos totales", t.expenses],
                  ["Costo completo asignado a platos", t.completeAssigned],
                  ["MOD no absorbida", t.idle],
                  ["CIF y gastos sin asignar", t.unassigned],
                  ["Asignado + no absorbido + sin asignar", t.bridge],
                  ["Costos del periodo", t.costs],
                  ["Ventas netas", t.sales],
                ] as [string, Dec][]
              ).map(([k, v]) => (
                <TableRow key={k}>
                  <TableCell>{k}</TableCell>
                  <TableCell numeric>{formatMoney(v, cur)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Resultado antes de impuesto a la renta · margen {ok ? pct(t.margin) : "—"}</TableCell>
                <TableCell numeric className="text-heading">
                  {ok ? formatMoney(t.profit, cur) : "Pendiente"}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Section>

        <Section title="Insumos consolidados para producir" text="Cantidades brutas con merma y rendimiento incluidos.">
          <Table className="min-w-[420px]">
            <TableHeader>
              <TableRow>
                <TableHead>Insumo</TableHead>
                <TableHead numeric>Cantidad</TableHead>
                <TableHead numeric>Costo total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.requirements.map((q) => (
                <TableRow key={String(q.materialId)}>
                  <TableCell className="font-bold text-heading">{q.name}</TableCell>
                  <TableCell numeric>
                    {formatQty(q.quantity)} {q.unit}
                  </TableCell>
                  <TableCell numeric>{formatMoney(q.amount, cur)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!result.requirements.length && <CardContent className="text-sm text-muted-foreground">Sin insumos registrados.</CardContent>}
        </Section>
      </div>

      <Section
        title="Real vs. presupuesto"
        text={
          snap ? (
            <>Ventas registradas de {period.label} frente al presupuesto v{budget!.number} publicado de este plan.</>
          ) : (
            <>Publica el plan para comparar las ventas registradas con su presupuesto.</>
          )
        }
      >
        {snap ? (
          <>
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Concepto</TableHead>
                  <TableHead numeric>Presupuesto</TableHead>
                  <TableHead numeric>Real</TableHead>
                  <TableHead numeric>Diferencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(
                  [
                    ["Ventas netas", snap.result.totals.sales, actual.net],
                    ["Materia prima", snap.result.totals.cmp, actual.materials],
                  ] as [string, string | null, Dec][]
                ).map(([k, b, a]) => (
                  <TableRow key={k}>
                    <TableCell>{k}</TableCell>
                    <TableCell numeric>{formatMoney(b, cur)}</TableCell>
                    <TableCell numeric>{formatMoney(a, cur)}</TableCell>
                    <TableCell numeric className="font-bold">
                      {b ? formatMoney(a.minus(b), cur) : <TableEmpty />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Plato</TableHead>
                  <TableHead numeric>Porciones presupuestadas</TableHead>
                  <TableHead numeric>Porciones vendidas</TableHead>
                  <TableHead numeric>Avance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snap.result.rows.map((row) => {
                  const sold = actual.rows.find((x) => x.name === row.name)?.quantity ?? new D(0);
                  const planned = new D(row.quantity);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-bold text-heading">{row.name}</TableCell>
                      <TableCell numeric>{formatQty(planned)}</TableCell>
                      <TableCell numeric>{formatQty(sold)}</TableCell>
                      <TableCell numeric>{planned.isZero() ? <TableEmpty /> : pct(sold.div(planned))}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <CardContent className="pt-4">
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                El presupuesto es la fotografía publicada; las ventas reales usan el precio y el costo de materiales congelados de cada venta. Los gastos y la planilla del mes
                están en Ventas (punto de equilibrio).
              </p>
            </CardContent>
          </>
        ) : (
          <CardContent>
            <Link href={`/app/plan/${plan.id}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
              Abrir el plan
            </Link>
          </CardContent>
        )}
      </Section>
    </>
  );
}
