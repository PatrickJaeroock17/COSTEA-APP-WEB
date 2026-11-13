import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, Boxes } from "lucide-react";
import { CreateRestaurant } from "@/components/app/create-restaurant";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { ImportPurchase, ReceiptForm, SeedOpening } from "@/components/app/inventario/forms";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fieldClass } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canEdit, getAppContext } from "@/lib/auth";
import { type StockRow, getInventory, getSavedPurchases } from "@/lib/data/inventory";
import { formatDate, formatMoney, formatQty, formatUnitPrice } from "@/lib/format";
import { limaToday } from "@/lib/materials";
import { cn } from "@/lib/utils";

export const metadata = { title: "costea — Inventario" };

type Props = { searchParams: Promise<{ plato?: string; insumo?: string; estado?: string }> };

export default function InventarioPage({ searchParams }: Props) {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<div className="h-[480px] animate-pulse rounded-3xl bg-white" aria-busy="true" aria-label="Cargando" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const name = (m: { name: string; variety: string | null }) => (m.variety ? `${m.name} - ${m.variety}` : m.name);

function movementLabel(r: StockRow["rows"][number]) {
  const mv = r.movement;
  if (mv.reference.startsWith("Stock inicial")) return "Stock inicial del catálogo";
  if (mv.sale_id) return `Venta #${mv.sale_id}`;
  if (mv.plan_id) return `Plan de producción #${mv.plan_id}`;
  if (mv.reference.startsWith("Compra guardada")) return "Compra con comprobante";
  if (mv.reference.startsWith("Entrada ")) return "Compra";
  return mv.kind === "in" ? `Entrada · ${mv.reference}` : mv.reference;
}

async function Content({ searchParams }: Props) {
  const [sp, ctx] = await Promise.all([searchParams, getAppContext()]);
  if (!ctx.restaurant) return <CreateRestaurant name={ctx.user.name.split(" ")[0]} />;
  const r = ctx.restaurant;
  const editable = canEdit(r.role);
  const productId = Number(sp.plato) || null;
  const [inventory, saved] = await Promise.all([getInventory(r.id, productId), editable ? getSavedPurchases(r.id) : Promise.resolve([])]);
  const lowOnly = sp.estado === "bajo";
  const rows = inventory.rows.filter((x) => (x.active || x.quantity) && (!lowOnly || x.simulation?.low));
  const low = inventory.rows.filter((x) => x.simulation?.low);
  const pending = inventory.rows.filter((x) => x.pending);
  const selected = inventory.rows.find((x) => x.id === Number(sp.insumo)) ?? null;
  const qs = (extra: Record<string, string | number | null>) => {
    const p = new URLSearchParams();
    const all = { plato: productId, estado: lowOnly ? "bajo" : null, ...extra };
    for (const [k, v] of Object.entries(all)) if (v !== null && v !== undefined && v !== "") p.set(k, String(v));
    return `/app/inventario${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader
        icon={Boxes}
        title="Inventario"
        text="Existencias con costo promedio ponderado. Las ventas y los presupuestos publicados descuentan insumos; aquí registras las entradas y ves qué alcanza para la carta."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { k: "Valor del inventario", v: formatMoney(inventory.totalValue, r.currency), n: "Al promedio ponderado" },
          { k: "Insumos con stock", v: String(inventory.rows.filter((x) => x.quantity?.gt(0)).length), n: `de ${inventory.rows.filter((x) => x.active).length} activos` },
          { k: "Stock bajo", v: String(low.length), n: "No alcanza para un lote de cada plato" },
          { k: "Valoración pendiente", v: String(pending.length), n: "Salidas mayores a las entradas" },
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

      {editable && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Registrar entrada</CardTitle>
            <CardDescription>
              Cantidad en la unidad base del insumo. Para comprar en otra presentación o registrar a la vez el precio, usa «Registrar compra» en la ficha del insumo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReceiptForm
              materials={inventory.rows.filter((x) => x.active).map((x) => ({ id: x.id, label: `${name(x)} · ${x.unit}` }))}
              defaultDate={limaToday()}
              defaultMaterial={selected?.id}
              currency={r.currency}
            />
          </CardContent>
        </Card>
      )}

      {editable && saved.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Compras con comprobante sin ingresar</CardTitle>
            <CardDescription>Costos guardados con cantidad de compra. Ingresarlos suma su cantidad al kardex con su costo unitario.</CardDescription>
          </CardHeader>
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>Insumo</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead numeric>Cantidad</TableHead>
                <TableHead numeric>Costo unitario</TableHead>
                <TableHead className="sr-only">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {saved.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <span className="font-bold text-heading">{s.material}</span>
                    <span className="block text-xs text-muted-foreground">{s.source}</span>
                  </TableCell>
                  <TableCell>{formatDate(s.date)}</TableCell>
                  <TableCell numeric>
                    {formatQty(s.quantity)} {s.unit}
                  </TableCell>
                  <TableCell numeric>{formatUnitPrice(s.unitCost, r.currency)}</TableCell>
                  <TableCell>
                    <ImportPurchase costVersionId={s.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Existencias</CardTitle>
          <CardDescription>
            «Un lote de la carta» suma lo que usa un lote de la receta vigente de cada plato activo; es una salida simulada que no mueve el inventario.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block flex-1 text-sm font-bold text-ink">
              Plato
              <select name="plato" defaultValue={productId ? String(productId) : ""} className={cn(fieldClass, "mt-1.5 h-12")}>
                <option value="">Todos los insumos</option>
                {inventory.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-bold text-ink sm:w-56">
              Mostrar
              <select name="estado" defaultValue={lowOnly ? "bajo" : ""} className={cn(fieldClass, "mt-1.5 h-12")}>
                <option value="">Todos</option>
                <option value="bajo">Solo stock bajo</option>
              </select>
            </label>
            <button type="submit" className={buttonVariants({ size: "lg" })}>
              Ver
            </button>
          </form>
        </CardContent>
        {rows.length ? (
          <Table className="min-w-[880px]">
            <TableHeader>
              <TableRow>
                <TableHead>Insumo</TableHead>
                <TableHead numeric>Stock</TableHead>
                <TableHead numeric>Promedio</TableHead>
                <TableHead numeric>Valor</TableHead>
                <TableHead numeric>Un lote de la carta</TableHead>
                <TableHead numeric>Saldo proyectado</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((x) => (
                <TableRow key={x.id} className={cn(selected?.id === x.id && "bg-brand-50")}>
                  <TableCell>
                    <Link href={`${qs({ insumo: x.id })}#kardex`} className="font-bold text-heading hover:underline">
                      {name(x)}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{x.code}</span>
                  </TableCell>
                  <TableCell numeric>{x.quantity ? `${formatQty(x.quantity)} ${x.unit}` : <TableEmpty />}</TableCell>
                  <TableCell numeric>{x.average && x.quantity?.gt(0) ? formatUnitPrice(x.average, r.currency) : <TableEmpty />}</TableCell>
                  <TableCell numeric>{x.value ? formatMoney(x.value, r.currency) : x.pending ? <span className="text-warning-text">Pendiente</span> : <TableEmpty />}</TableCell>
                  <TableCell numeric>{x.simulation ? `${formatQty(x.simulation.needed)} ${x.unit}` : <TableEmpty />}</TableCell>
                  <TableCell numeric>{x.simulation ? `${formatQty(x.simulation.projectedQuantity)} ${x.unit}` : <TableEmpty />}</TableCell>
                  <TableCell>
                    {x.pending ? (
                      <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-bold text-warning-text">Valoración pendiente</span>
                    ) : x.simulation?.low ? (
                      <span className="rounded-full bg-danger-soft px-2.5 py-1 text-xs font-bold text-danger-text">Stock bajo</span>
                    ) : x.simulation ? (
                      <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success-text">Alcanza</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin uso en la carta</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <CardContent className="text-sm text-muted-foreground">{lowOnly ? "Ningún insumo con stock bajo." : "Aún no hay insumos."}</CardContent>
        )}
      </Card>

      {selected && (
        <Card className="mt-6" id="kardex">
          <CardHeader>
            <CardTitle>Kardex · {name(selected)}</CardTitle>
            <CardDescription>
              Promedio ponderado móvil; el mismo día las entradas van primero. Más detalle y compras en la{" "}
              <Link href={`/app/insumos/${selected.id}`} className="font-bold text-primary hover:underline">
                ficha del insumo
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Movimiento</TableHead>
                <TableHead numeric>Entrada</TableHead>
                <TableHead numeric>Salida</TableHead>
                <TableHead numeric>Costo unit.</TableHead>
                <TableHead numeric>Saldo</TableHead>
                <TableHead numeric>Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selected.rows.map((row) => (
                <TableRow key={row.movement.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(row.movement.movement_on)}</TableCell>
                  <TableCell>{movementLabel(row)}</TableCell>
                  <TableCell numeric>{row.movement.kind === "in" ? formatQty(row.movement.quantity) : ""}</TableCell>
                  <TableCell numeric>{row.movement.kind === "out" ? formatQty(row.movement.quantity) : ""}</TableCell>
                  <TableCell numeric>{row.unitCost ? formatUnitPrice(row.unitCost, r.currency) : <TableEmpty />}</TableCell>
                  <TableCell numeric>
                    {formatQty(row.quantity)} {selected.unit}
                  </TableCell>
                  <TableCell numeric>{row.value === null ? <span className="text-warning-text">Pendiente</span> : formatMoney(row.value, r.currency)}</TableCell>
                </TableRow>
              ))}
              {selected.simulation && (
                <TableRow className="bg-surface text-muted-foreground italic">
                  <TableCell>Simulación</TableCell>
                  <TableCell>Un lote de: {selected.dishes.join(", ")}</TableCell>
                  <TableCell />
                  <TableCell numeric>{formatQty(selected.simulation.needed)}</TableCell>
                  <TableCell numeric>{selected.simulation.unitCost ? formatUnitPrice(selected.simulation.unitCost, r.currency) : <TableEmpty />}</TableCell>
                  <TableCell numeric>
                    {formatQty(selected.simulation.projectedQuantity)} {selected.unit}
                  </TableCell>
                  <TableCell numeric>{selected.simulation.projectedValue ? formatMoney(selected.simulation.projectedValue, r.currency) : <TableEmpty />}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {!selected.rows.length && <CardContent className="text-sm text-muted-foreground">Sin movimientos.</CardContent>}
          {selected.simulation?.low && (
            <CardContent>
              <p className="flex items-start gap-2 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-text">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                Stock bajo: hay {formatQty(selected.quantity ?? 0)} {selected.unit} y un lote de cada plato que lo usa necesita {formatQty(selected.simulation.needed)} {selected.unit}
                {selected.simulation.missing.gt(0) ? ` (faltan ${formatQty(selected.simulation.missing)} ${selected.unit})` : ""}.
              </p>
            </CardContent>
          )}
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Stock de apertura del catálogo</CardTitle>
          <CardDescription>
            {inventory.opening.count
              ? `${inventory.opening.count} entradas iniciales por ${formatMoney(inventory.opening.value, r.currency)}. Solo se agregan las que falten; lo consumido nunca se repone.`
              : r.currency === "PEN"
                ? "Aún no hay entradas iniciales del catálogo."
                : "El stock de apertura del catálogo está en soles; este restaurante trabaja en otra moneda."}
          </CardDescription>
        </CardHeader>
        {editable && r.currency === "PEN" && (
          <CardContent>
            <SeedOpening />
          </CardContent>
        )}
      </Card>

      {!inventory.rows.length && (
        <div className="mt-6">
          <EmptyState title="Aún no hay insumos" text="Agrégalos en Insumos para empezar el kardex." />
        </div>
      )}
    </>
  );
}
