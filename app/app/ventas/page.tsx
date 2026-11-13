import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, ShoppingCart } from "lucide-react";
import { CreateRestaurant } from "@/components/app/create-restaurant";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { DeleteSale, SaleForm } from "@/components/app/ventas/forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableEmpty, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canEdit, getAppContext } from "@/lib/auth";
import { D } from "@/lib/costing/decimal";
import { getMonthlyResults } from "@/lib/data/sales";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { limaToday, periodDates } from "@/lib/materials";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "costea — Ventas" };

export default function VentasPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<div className="h-[480px] animate-pulse rounded-3xl bg-white" aria-busy="true" aria-label="Cargando" />}>
        <Content />
      </Suspense>
    </div>
  );
}

const pct = (d: InstanceType<typeof D> | null) => (d ? `${d.times(100).toDecimalPlaces(1).toFixed()} %` : "—");

async function Content() {
  const ctx = await getAppContext();
  if (!ctx.restaurant) return <CreateRestaurant name={ctx.user.name.split(" ")[0]} />;
  const r = ctx.restaurant;
  const period = ctx.period;
  const header = (
    <PageHeader
      icon={ShoppingCart}
      title="Ventas"
      text="Registra lo vendido cada día. Cada venta guarda su precio con IGV y el costo de materiales de esa fecha, y descuenta los insumos del inventario."
    />
  );
  if (!period) return <>{header}<div className="mt-6"><EmptyState title="Agrega un mes de trabajo" text="Créalo en Configuración." /></div></>;
  const editable = canEdit(r.role);
  const supabase = await createClient();
  const [results, { data: products }, { data: prices }] = await Promise.all([
    getMonthlyResults(r.id, period),
    supabase.from("products").select("id, name").eq("restaurant_id", r.id).eq("active", true).order("name"),
    supabase.from("product_prices").select("product_id, amount::text").eq("restaurant_id", r.id),
  ]);
  const priceOf = new Map(((prices ?? []) as unknown as { product_id: number; amount: string }[]).map((p) => [p.product_id, p.amount]));
  const today = limaToday();
  const defaultDate = today >= results.range.start && today <= results.range.end ? today : periodDates(period).reference;

  return (
    <>
      {header}

      {editable && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Registrar venta de {period.label}</CardTitle>
            <CardDescription>
              Se usa el precio de carta vigente. Los platos sin precio aparecen deshabilitados:{" "}
              <Link href="/app/platos?tab=precios" className="font-bold text-primary hover:underline">
                fija sus precios
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SaleForm
              products={((products ?? []) as { id: number; name: string }[]).map((p) => ({
                id: p.id,
                priced: priceOf.has(p.id),
                label: priceOf.has(p.id) ? `${p.name} · ${formatMoney(priceOf.get(p.id), r.currency)}` : `${p.name} · sin precio`,
              }))}
              defaultDate={defaultDate}
              min={results.range.start}
              max={results.range.end}
            />
          </CardContent>
        </Card>
      )}

      {results.missingStaff > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-text">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {results.missingStaff === 1 ? "1 trabajador activo no tiene" : `${results.missingStaff} trabajadores activos no tienen`} costo de {period.label}: los costos fijos están incompletos.
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { k: "Ventas con IGV", v: formatMoney(results.gross, r.currency), n: `IGV ${formatMoney(results.tax, r.currency)}` },
          { k: "Ventas netas", v: formatMoney(results.net, r.currency), n: "Sin IGV" },
          { k: "Utilidad del mes", v: formatMoney(results.profit, r.currency), n: `Costos ${formatMoney(results.costs, r.currency)}` },
          {
            k: "Punto de equilibrio",
            v: results.equilibrium ? formatMoney(results.equilibrium, r.currency) : "—",
            n: results.equilibriumGross ? `${formatMoney(results.equilibriumGross, r.currency)} con IGV` : results.ratio && results.ratio.lte(0) ? "El margen de contribución no cubre los costos" : "Sin ventas",
          },
        ].map((c) => (
          <Card key={c.k} size="sm">
            <CardContent>
              <p className="text-sm font-semibold text-muted-foreground">{c.k}</p>
              <p className="mt-1 font-brand text-2xl font-extrabold tabular-nums text-heading">{c.v}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.n}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Resultado por plato</CardTitle>
          <CardDescription>
            Margen de contribución {pct(results.ratio)} sobre la venta neta. Los gastos variables y fijos ({formatMoney(results.fixed, r.currency)}, incluida la planilla) se reparten
            según la venta neta de cada plato.
          </CardDescription>
        </CardHeader>
        {results.rows.length ? (
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead>Plato</TableHead>
                <TableHead numeric>Porciones</TableHead>
                <TableHead numeric>Venta neta</TableHead>
                <TableHead numeric>Materiales</TableHead>
                <TableHead numeric>Variables</TableHead>
                <TableHead numeric>Contribución</TableHead>
                <TableHead numeric>Fijos</TableHead>
                <TableHead numeric>Utilidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.rows.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-bold text-heading">{row.name}</TableCell>
                  <TableCell numeric>{formatQty(row.quantity)}</TableCell>
                  <TableCell numeric>{formatMoney(row.net, r.currency)}</TableCell>
                  <TableCell numeric>{formatMoney(row.materials, r.currency)}</TableCell>
                  <TableCell numeric>{formatMoney(row.variable, r.currency)}</TableCell>
                  <TableCell numeric>{formatMoney(row.contribution, r.currency)}</TableCell>
                  <TableCell numeric>{formatMoney(row.fixed, r.currency)}</TableCell>
                  <TableCell numeric className="font-bold">
                    {formatMoney(row.profit, r.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell numeric>{formatMoney(results.net, r.currency)}</TableCell>
                <TableCell numeric>{formatMoney(results.materials, r.currency)}</TableCell>
                <TableCell numeric>{formatMoney(results.variable, r.currency)}</TableCell>
                <TableCell numeric>{formatMoney(results.net.minus(results.variable), r.currency)}</TableCell>
                <TableCell numeric>{formatMoney(results.fixed, r.currency)}</TableCell>
                <TableCell numeric>{formatMoney(results.profit, r.currency)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        ) : (
          <CardContent className="text-sm text-muted-foreground">Aún no hay ventas en {period.label}.</CardContent>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Ventas registradas</CardTitle>
          <CardDescription>Precio y costo quedan como estaban el día de la venta.</CardDescription>
        </CardHeader>
        {results.sales.length ? (
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Plato</TableHead>
                <TableHead numeric>Porciones</TableHead>
                <TableHead numeric>Precio con IGV</TableHead>
                <TableHead numeric>Costo materiales</TableHead>
                <TableHead numeric>Total con IGV</TableHead>
                {editable && <TableHead className="sr-only">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.sales.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(s.sold_on)}</TableCell>
                  <TableCell className="font-bold text-heading">{s.products?.name ?? <TableEmpty />}</TableCell>
                  <TableCell numeric>{formatQty(s.quantity)}</TableCell>
                  <TableCell numeric>{formatMoney(s.unit_price, r.currency)}</TableCell>
                  <TableCell numeric>{formatMoney(s.unit_cost, r.currency, 4)}</TableCell>
                  <TableCell numeric className="font-bold">
                    {formatMoney(new D(s.quantity).times(s.unit_price), r.currency)}
                  </TableCell>
                  {editable && (
                    <TableCell>
                      <DeleteSale saleId={s.id} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <CardContent className="text-sm text-muted-foreground">Sin ventas en {period.label}.</CardContent>
        )}
      </Card>
    </>
  );
}
