import Link from "next/link";
import { Suspense } from "react";
import { Info, Pencil, Receipt } from "lucide-react";
import { CreateRestaurant } from "@/components/app/create-restaurant";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { NewConcept, ToggleConcept } from "@/components/app/gastos/forms";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableEmpty, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canEdit, getAppContext } from "@/lib/auth";
import { laborCost } from "@/lib/costing/costing";
import { D } from "@/lib/costing/decimal";
import { overheadTables } from "@/lib/costing/reports";
import { getConcepts, getProductChoices } from "@/lib/data/expenses";
import { getEmployees, getPeriodCosts, staffInputs } from "@/lib/data/personal";
import { getAllocationLines } from "@/lib/data/plan";
import { BASES, BEHAVIORS, KINDS } from "@/lib/expenses";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "costea — Gastos" };

type Props = { searchParams: Promise<{ guardado?: string }> };

export default function GastosPage({ searchParams }: Props) {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<div className="h-[480px] animate-pulse rounded-3xl bg-white" aria-busy="true" aria-label="Cargando" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.short]));
const BASIS_LABEL = Object.fromEntries(BASES.map((b) => [b.value, b.label]));
const BEHAVIOR_LABEL = Object.fromEntries(BEHAVIORS.map((b) => [b.value, b.label]));

async function Content({ searchParams }: Props) {
  const [sp, ctx] = await Promise.all([searchParams, getAppContext()]);
  if (!ctx.restaurant) return <CreateRestaurant name={ctx.user.name.split(" ")[0]} />;
  const r = ctx.restaurant;
  const period = ctx.period;
  if (!period) {
    return <EmptyState title="Agrega un mes de trabajo" text="Los gastos se presupuestan por mes. Créalo en Configuración." />;
  }
  const editable = canEdit(r.role);
  const [concepts, products, employees, costs, allocationLines] = await Promise.all([
    getConcepts(r.id, period.id),
    getProductChoices(r.id),
    getEmployees(r.id),
    getPeriodCosts(r.id, period.id),
    getAllocationLines(r.id, period.id),
  ]);

  // La parte indirecta de la planilla se suma a cada grupo una sola vez (legacy: salary-{id}-{kind}).
  const staff = staffInputs(employees, costs);
  const payroll = staff.flatMap((s) => {
    const cost = laborCost(s);
    return (["cif", "admin", "sales"] as const)
      .filter((k) => !cost.indirect[k].isZero())
      .map((k) => ({ id: `salary-${s.id}-${k}`, name: `Personal · ${s.name}`, kind: k, amount: cost.indirect[k], basis: s.basis, bases: new Map(), exact: new Map() }));
  });
  const groups = overheadTables(
    concepts.map((c) => ({ id: c.id, name: c.name, kind: c.kind, amount: c.amount, active: c.active, basis: c.basis })),
    { allocations: payroll },
  );
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const productName = new Map(products.map((p) => [p.id, p.name]));
  const total = groups.reduce((acc, g) => acc.plus(g.monthly), new D(0));
  const fixed = concepts.filter((c) => c.active && c.behavior === "fixed").reduce((acc, c) => acc.plus(c.amount), new D(0));

  return (
    <>
      <PageHeader
        icon={Receipt}
        title="Gastos"
        text={
          <>
            Presupuesto de <strong>{period.label}</strong>: costos indirectos de fabricación, gastos administrativos, de ventas, financieros y otros. Cada uno se reparte entre los
            platos según su base.
          </>
        }
      >
        {editable && <NewConcept periodId={period.id} periodLabel={period.label} currency={r.currency} products={products.filter((p) => p.active)} allocationLines={allocationLines} />}
      </PageHeader>

      {sp.guardado && (
        <p role="status" className="mt-4 rounded-xl bg-success-soft px-4 py-3 text-sm font-semibold text-success-text">
          Gasto registrado.
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total del mes", value: total, note: "Incluye la parte indirecta del personal." },
          { label: "CIF", value: groups.find((g) => g.kind === "cif")?.monthly ?? new D(0) },
          {
            label: "Administración y ventas",
            value: groups.filter((g) => g.kind === "admin" || g.kind === "sales").reduce((a, g) => a.plus(g.monthly), new D(0)),
          },
          { label: "Gastos fijos registrados", value: fixed, note: "Sin la planilla." },
        ].map((k) => (
          <Card key={k.label} size="sm">
            <CardContent>
              <p className="text-sm font-semibold text-muted-foreground">{k.label}</p>
              <p className="mt-1 font-brand text-2xl font-extrabold tabular-nums text-heading">{formatMoney(k.value, r.currency)}</p>
              {k.note && <p className="mt-1 text-xs text-muted-foreground">{k.note}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-xl bg-info-soft px-4 py-3 text-sm text-info-text">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        El monto por plato y por porción se calcula en Costo y precio por plato, con las cantidades del plan de producción.
      </p>

      {!concepts.length && !payroll.length ? (
        <div className="mt-6">
          <EmptyState title={`Sin gastos en ${period.label}`} text="Registra alquiler, luz, gas, sueldos administrativos, publicidad, comisiones… Si no hay, el plan te pedirá declararlo." />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {groups
            .filter((g) => g.rows.length)
            .map((g) => (
              <Card key={g.kind}>
                <CardHeader>
                  <CardTitle>{KINDS.find((k) => k.value === g.kind)?.label}</CardTitle>
                  <CardDescription>
                    {formatMoney(g.monthly, r.currency)} al mes · {g.rows.filter((x) => x.active).length} {g.rows.filter((x) => x.active).length === 1 ? "concepto" : "conceptos"}
                  </CardDescription>
                </CardHeader>
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Base</TableHead>
                      <TableHead>Destinatarios</TableHead>
                      <TableHead numeric>Importe mensual</TableHead>
                      {editable && <TableHead className="sr-only">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.rows.map((row) => {
                      const c = row.id !== null ? byId.get(Number(row.id)) : undefined;
                      return (
                        <TableRow key={row.key} className={cn(!row.active && "text-muted-foreground")}>
                          <TableCell>
                            {row.payroll ? (
                              <Link href="/app/personal" className="font-bold text-heading hover:underline">
                                {row.name}
                              </Link>
                            ) : (
                              <span className="font-bold text-heading">{row.name}</span>
                            )}
                            {!row.active && <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-xs font-bold">Excluido</span>}
                            {row.payroll && <span className="block text-xs text-muted-foreground">Parte indirecta de la planilla</span>}
                          </TableCell>
                          <TableCell>{c ? BEHAVIOR_LABEL[c.behavior] : "Fijo"}</TableCell>
                          <TableCell>{BASIS_LABEL[row.basis] ?? row.basis}</TableCell>
                          <TableCell className="max-w-56 truncate">
                            {c && c.targets.length ? c.targets.map((t) => productName.get(t) ?? `#${t}`).join(", ") : <span className="text-muted-foreground">Todos</span>}
                          </TableCell>
                          <TableCell numeric className="font-bold">
                            {formatMoney(row.amount, r.currency)}
                          </TableCell>
                          {editable && (
                            <TableCell>
                              {c ? (
                                <div className="flex justify-end gap-1">
                                  <Link href={`/app/gastos/${c.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                                    <Pencil aria-hidden />
                                    Editar
                                  </Link>
                                  <ToggleConcept conceptId={c.id} active={c.active} />
                                </div>
                              ) : (
                                <TableEmpty />
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4}>Total {KIND_LABEL[g.kind]?.toLowerCase()}</TableCell>
                      <TableCell numeric>{formatMoney(g.monthly, r.currency)}</TableCell>
                      {editable && <TableCell />}
                    </TableRow>
                  </TableFooter>
                </Table>
              </Card>
            ))}
        </div>
      )}
    </>
  );
}
