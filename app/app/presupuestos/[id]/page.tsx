import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Download, Lock } from "lucide-react";
import { ArchiveBudget } from "@/components/app/presupuestos/forms";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableEmpty, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canEdit, getAppContext } from "@/lib/auth";
import { D } from "@/lib/costing/decimal";
import { getBudget } from "@/lib/data/budgets";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { PRICING_MODES } from "@/lib/pricing";
import { igvLabel } from "@/lib/restaurants";

export const metadata = { title: "costea — Presupuesto" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ publicado?: string }> };

export default function PresupuestoPage(props: Props) {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<div className="h-[600px] animate-pulse rounded-3xl bg-white" aria-busy="true" aria-label="Cargando" />}>
        <Detail {...props} />
      </Suspense>
    </div>
  );
}

const pct = (v: string | null | undefined) => (v ? `${new D(v).times(100).toDecimalPlaces(1).toFixed()} %` : "—");

async function Detail({ params, searchParams }: Props) {
  const [{ id }, sp, ctx] = await Promise.all([params, searchParams, getAppContext()]);
  const r = ctx.restaurant;
  const budgetId = Number(id);
  if (!r || !Number.isInteger(budgetId) || budgetId <= 0) notFound();
  const budget = await getBudget(r.id, budgetId);
  if (!budget) notFound();
  const { input, result } = budget.snapshot;
  const meta = input.meta ?? {};
  const currency = meta.currency ?? r.currency;
  // Tasa congelada en la fotografía (presupuestos anteriores al IGV configurable: la de sus líneas, 18 %).
  const igv = igvLabel(meta.igvRate ?? input.lines?.[0]?.tax ?? null);
  const t = result.totals;
  const modeOf = new Map((input.lines ?? []).map((l) => [Number(l.id), PRICING_MODES.find((m) => m.value === l.pricingMode)?.label]));

  return (
    <>
      <Link href="/app/presupuestos" className={buttonVariants({ variant: "link" })}>
        <ArrowLeft aria-hidden />
        Presupuestos
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-brand text-3xl font-extrabold tracking-[-0.02em] text-heading sm:text-4xl">
            {meta.plan ?? "Presupuesto"} · v{budget.number}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {meta.period} · publicado el {formatDate(budget.created_at)} · precios de insumos al {formatDate(meta.priceDate)} · IGV {igv}
            {budget.archived && " · archivado"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/app/presupuestos/${budget.id}/descargar`} className={buttonVariants({ variant: "outline", size: "lg" })}>
            <Download aria-hidden />
            Descargar JSON
          </a>
          {canEdit(r.role) && <ArchiveBudget budgetId={budget.id} archived={budget.archived} />}
        </div>
      </div>

      {sp.publicado && (
        <p role="status" className="mt-4 rounded-xl bg-success-soft px-4 py-3 text-sm font-semibold text-success-text">
          Presupuesto publicado. Los insumos del plan se descontaron del kardex.
        </p>
      )}
      <p className="mt-4 flex items-start gap-2 rounded-2xl bg-surface px-4 py-3 text-sm text-ink-soft">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
        Fotografía fija: no cambia aunque después edites recetas, precios, personal o gastos. Huella {budget.fingerprint.slice(0, 12)}… · motor {result.engine}.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Ventas netas", formatMoney(t.sales, currency)],
          ["Costos del mes", formatMoney(t.costs, currency)],
          ["Utilidad", formatMoney(t.profit, currency)],
          ["Margen", pct(t.margin)],
        ].map(([k, v]) => (
          <Card key={k} size="sm">
            <CardContent>
              <p className="text-sm font-semibold text-muted-foreground">{k}</p>
              <p className="mt-1 font-brand text-2xl font-extrabold tabular-nums text-heading">{v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Costo y precio por plato</CardTitle>
          <CardDescription>Por porción, con IGV {igv} en el precio (tasa congelada al publicar).</CardDescription>
        </CardHeader>
        <Table className="min-w-[860px]">
          <TableHeader>
            <TableRow>
              <TableHead>Plato</TableHead>
              <TableHead numeric>Porciones</TableHead>
              <TableHead numeric>Materiales</TableHead>
              <TableHead numeric>Mano de obra</TableHead>
              <TableHead numeric>CIF y gastos</TableHead>
              <TableHead numeric>Costo total</TableHead>
              <TableHead numeric>Precio</TableHead>
              <TableHead numeric>Margen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((row) => {
              const q = new D(row.quantity);
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <span className="font-bold text-heading">{row.name}</span>
                    <span className="block text-xs text-muted-foreground">{modeOf.get(Number(row.id))}</span>
                  </TableCell>
                  <TableCell numeric>{formatQty(row.quantity)}</TableCell>
                  <TableCell numeric>{formatMoney(row.cmp, currency)}</TableCell>
                  <TableCell numeric>{formatMoney(row.mod, currency)}</TableCell>
                  <TableCell numeric>{q.isZero() ? <TableEmpty /> : formatMoney(new D(row.cif).plus(row.expenses).div(q), currency)}</TableCell>
                  <TableCell numeric className="font-bold">
                    {row.complete ? formatMoney(row.complete, currency) : <TableEmpty />}
                  </TableCell>
                  <TableCell numeric className="font-bold text-heading">
                    {row.price ? formatMoney(row.price.final, currency) : <TableEmpty />}
                  </TableCell>
                  <TableCell numeric>{row.price ? pct(row.price.margin) : <TableEmpty />}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5}>Costo completo asignado</TableCell>
              <TableCell numeric>{formatMoney(t.completeAssigned, currency)}</TableCell>
              <TableCell colSpan={2} className="text-xs font-semibold text-muted-foreground">
                + ociosa {formatMoney(t.idle, currency)} + sin base {formatMoney(t.unassigned, currency)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Estado de resultados del mes</CardTitle>
          </CardHeader>
          <Table>
            <TableBody>
              {[
                ["Ventas netas", t.sales],
                ["Materia prima", t.cmp],
                ["Mano de obra directa disponible", t.modAvailable],
                ["CIF", t.cif],
                ["Gastos administrativos", t.admin],
                ["Gastos de ventas", t.selling],
                ["Gastos financieros", t.finance],
              ].map(([k, v]) => (
                <TableRow key={k}>
                  <TableCell>{k}</TableCell>
                  <TableCell numeric>{formatMoney(v, currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Utilidad</TableCell>
                <TableCell numeric className="text-heading">
                  {formatMoney(t.profit, currency)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Insumos del plan</CardTitle>
            <CardDescription>Descontados del kardex al publicar por primera vez.</CardDescription>
          </CardHeader>
          <Table className="min-w-[420px]">
            <TableHeader>
              <TableRow>
                <TableHead>Insumo</TableHead>
                <TableHead numeric>Cantidad</TableHead>
                <TableHead numeric>Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.requirements.map((q) => (
                <TableRow key={q.materialId}>
                  <TableCell className="font-bold text-heading">{q.name}</TableCell>
                  <TableCell numeric>
                    {formatQty(q.quantity)} {q.unit}
                  </TableCell>
                  <TableCell numeric>{formatMoney(q.amount, currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
