import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { PlanLineForm, RemoveLine } from "@/components/app/costos/forms";
import { PlanStatusBox } from "@/components/app/costos/status";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canEdit, getAppContext } from "@/lib/auth";
import { D, decimalText } from "@/lib/costing/decimal";
import { portionSummary } from "@/lib/costing/reports";
import { evaluatePlan, getPlan } from "@/lib/data/plan";
import { formatMoney, formatQty } from "@/lib/format";
import { PRICING_MODES, pricingInput } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "costea — Costo del plato" };

type Props = { params: Promise<{ lineId: string }> };

export default function CostoPlatoPage(props: Props) {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<div className="h-[600px] animate-pulse rounded-3xl bg-white" aria-busy="true" aria-label="Cargando" />}>
        <Detail {...props} />
      </Suspense>
    </div>
  );
}

const pct = (d: InstanceType<typeof D> | null) => (d ? `${d.times(100).toDecimalPlaces(1).toFixed()} %` : "—");

async function Detail({ params }: Props) {
  const [{ lineId }, ctx] = await Promise.all([params, getAppContext()]);
  const r = ctx.restaurant;
  const id = Number(lineId);
  if (!r || !Number.isInteger(id) || id <= 0) notFound();
  const supabase = await createClient();
  const { data: ref } = await supabase.from("plan_lines").select("plan_id").eq("restaurant_id", r.id).eq("id", id).maybeSingle();
  const plan = ref ? await getPlan(r.id, ref.plan_id) : null;
  if (!plan) notFound();
  const { result, lines } = await evaluatePlan(r.id, plan, { name: r.name, currency: r.currency });
  const line = lines.find((l) => l.id === id)!;
  const row = result.rows.find((x) => Number(x.id) === id)!;
  const summary = portionSummary(result, id, "0.18");
  const price = row.price;
  const editable = canEdit(r.role);
  const portions = formatQty(row.quantity);

  return (
    <>
      <Link href={`/app/costos?plan=${plan.id}`} className={buttonVariants({ variant: "link" })}>
        <ArrowLeft aria-hidden />
        Costo y precio
      </Link>
      <h1 className="mt-2 font-brand text-3xl font-extrabold tracking-[-0.02em] text-heading sm:text-4xl">{row.name}</h1>
      <p className="mt-1 text-muted-foreground">
        {plan.name} · {portions} porciones al mes · receta versión {line.recipeNumber}
      </p>
      {!summary.complete && (
        <div className="mt-4">
          <PlanStatusBox status={result.status} issues={result.issues} />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Costo de una porción</CardTitle>
            <CardDescription>Materiales y mano de obra ya son por porción; CIF y gastos son lo asignado en el mes ÷ {portions} porciones.</CardDescription>
          </CardHeader>
          <Table>
            <TableBody>
              {summary.components.map(([label, value]) => (
                <TableRow key={label}>
                  <TableCell>{label}</TableCell>
                  <TableCell numeric>{value ? formatMoney(value, r.currency, 4) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Costo total por porción</TableCell>
                <TableCell numeric className="text-heading">
                  {row.complete ? formatMoney(row.complete, r.currency) : "—"}
                  {!summary.complete && <span className="block text-xs font-semibold text-warning-text">Provisional</span>}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Card>

        <Card variant="dark">
          <CardHeader>
            <CardTitle>{line.pricing_mode === "manual" ? "Precio definido" : "Precio sugerido"}</CardTitle>
            <CardDescription>{PRICING_MODES.find((m) => m.value === line.pricing_mode)?.hint}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-brand text-4xl font-extrabold tabular-nums text-white">{price ? formatMoney(price.final, r.currency) : "—"}</p>
            <p className="text-sm text-white/80">con IGV 18 %</p>
            {price && (
              <dl className="mt-5 space-y-2 text-sm">
                {[
                  ["Sugerido sin redondear", formatMoney(price.suggested, r.currency, 4)],
                  ["Precio sin IGV", formatMoney(price.net, r.currency)],
                  ["IGV", formatMoney(price.tax, r.currency)],
                  ["Utilidad por porción", formatMoney(price.result, r.currency)],
                  ["Margen sobre la venta", pct(price.margin)],
                  ["Recargo sobre el costo", pct(price.markup)],
                  ["Food cost (costo ÷ venta)", pct(price.costRatio)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-white/70">{k}</dt>
                    <dd className="font-bold tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>

      {editable && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Precio y datos del mes</CardTitle>
            <CardDescription>Los objetivos se escriben en %. Cambiar las porciones también cambia cuánto CIF y gasto le toca a cada plato.</CardDescription>
          </CardHeader>
          <CardContent>
            <PlanLineForm
              planId={plan.id}
              productId={line.product_id}
              currency={r.currency}
              outdated={line.recipeNumber < line.latestNumber ? { current: line.recipeNumber, latest: line.latestNumber } : null}
              initial={{
                quantity: decimalText(line.quantity),
                referencePrice: decimalText(line.reference_price),
                equivalentFactor: decimalText(line.equivalent_factor),
                pricingMode: line.pricing_mode,
                pricingValue: pricingInput(line.pricing_mode, line.pricing_value),
                adoptedPrice: line.adopted_price ? decimalText(line.adopted_price) : "",
              }}
            />
            <div className="mt-6 border-t border-line pt-4">
              <RemoveLine lineId={id} back={`/app/costos?plan=${plan.id}`} />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Materiales por lote</CardTitle>
            <CardDescription>Precio del kardex a la fecha del plan o, si no hay, el guardado en la receta.</CardDescription>
          </CardHeader>
          <Table className="min-w-[440px]">
            <TableHeader>
              <TableRow>
                <TableHead>Insumo</TableHead>
                <TableHead numeric>Bruto</TableHead>
                <TableHead numeric>Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {row.materialDetails.map((m) => (
                <TableRow key={`${m.name}-${String(m.version)}`}>
                  <TableCell>
                    <span className="font-bold text-heading">{m.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatMoney(m.unitCost, r.currency, 4)} · {m.origin}
                    </span>
                  </TableCell>
                  <TableCell numeric>{formatQty(m.gross, 4)}</TableCell>
                  <TableCell numeric>{formatMoney(m.amount, r.currency, 4)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!row.materialDetails.length && <CardContent className="text-sm text-muted-foreground">Sin insumos.</CardContent>}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Mano de obra por porción</CardTitle>
            <CardDescription>
              <Link href={`/app/personal?tab=platos&plato=${line.product_id}`} className="font-bold text-primary hover:underline">
                Editar operaciones del plato
              </Link>
            </CardDescription>
          </CardHeader>
          <Table className="min-w-[440px]">
            <TableHeader>
              <TableRow>
                <TableHead>Trabajador</TableHead>
                <TableHead numeric>Minutos</TableHead>
                <TableHead numeric>Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {row.laborDetails.map((l, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <span className="font-bold text-heading">{l.name}</span>
                    <span className="block text-xs text-muted-foreground">{l.byQuantity ? "Reparto por porciones" : l.activity}</span>
                  </TableCell>
                  <TableCell numeric>{l.byQuantity ? "—" : formatQty(l.minutes, 2)}</TableCell>
                  <TableCell numeric>{formatMoney(l.amount, r.currency, 4)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!row.laborDetails.length && <CardContent className={cn("text-sm text-muted-foreground")}>Sin mano de obra asignada.</CardContent>}
        </Card>
      </div>
    </>
  );
}
