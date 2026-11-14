import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, BookOpen, Boxes, History, Ruler, Tag } from "lucide-react";
import { card } from "@/components/app/form";
import { ConversionForm, MaterialActions, MaterialDataForm, StatusButton } from "@/components/app/insumos/detail-forms";
import { canEdit, getAppContext } from "@/lib/auth";
import { D } from "@/lib/costing/decimal";
import { ledger } from "@/lib/costing/inventory";
import { acquisitionCost, effectiveVersion, versionResult } from "@/lib/costing/materials";
import { getCategories, getMaterialDetail, toCostVersion, toMovement } from "@/lib/data/materials";
import { formatDate, formatMoney, formatQty, formatUnitPrice } from "@/lib/format";
import { materialName, periodDates, purchaseOptions } from "@/lib/materials";
import { cn } from "@/lib/utils";

export const metadata = { title: "costea — Insumo" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ agregado?: string; creado?: string }> };

export default function InsumoPage(props: Props) {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<div className="h-[600px] animate-pulse rounded-3xl bg-card" aria-busy="true" aria-label="Cargando" />}>
        <Detail {...props} />
      </Suspense>
    </div>
  );
}

function Section({ icon: Icon, title, text, children, id }: { icon: typeof Tag; title: string; text?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className={cn(card, "p-5 sm:p-7")}>
      <div className="flex items-center gap-2.5">
        <Icon className="size-5 text-primary" aria-hidden />
        <h2 className="font-brand text-xl font-extrabold text-heading">{title}</h2>
      </div>
      {text && <p className="mt-1 text-sm text-muted-foreground">{text}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "warn" }) {
  return (
    <div className={cn(card, "p-5")}>
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-brand text-2xl font-extrabold tabular-nums", tone === "warn" ? "text-warning-text" : "text-heading")}>{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/** Línea de precios por fecha de vigencia (solo dibujo; los importes se muestran en la tabla). */
function PriceChart({ points, currency }: { points: { date: string; value: InstanceType<typeof D> }[]; currency: string }) {
  if (points.length < 2) return null;
  const W = 640, H = 160, L = 8, R = 8, T = 14, B = 14;
  let low = points[0].value, high = points[0].value;
  for (const p of points) {
    if (p.value.lt(low)) low = p.value;
    if (p.value.gt(high)) high = p.value;
  }
  if (low.eq(high)) {
    low = low.minus(1).lt(0) ? new D(0) : low.minus(1);
    high = high.plus(1);
  }
  const xy = points.map((p, i) => {
    const x = L + ((W - L - R) * i) / (points.length - 1);
    const y = T + high.minus(p.value).div(high.minus(low)).times(H - T - B).toNumber();
    return { x, y, ...p };
  });
  return (
    <figure className="mb-5">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full" role="img" aria-label={`Evolución del precio: de ${formatUnitPrice(points[0].value, currency)} a ${formatUnitPrice(points.at(-1)!.value, currency)}`}>
        <polyline points={xy.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" className="stroke-primary" strokeWidth="2.5" strokeLinejoin="round" />
        {xy.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" className="fill-card stroke-primary" strokeWidth="2">
            <title>{`${formatDate(p.date)}: ${formatUnitPrice(p.value, currency)}`}</title>
          </circle>
        ))}
      </svg>
    </figure>
  );
}

async function Detail({ params, searchParams }: Props) {
  const [{ id }, sp, ctx] = await Promise.all([params, searchParams, getAppContext()]);
  const r = ctx.restaurant;
  const materialId = Number(id);
  if (!r || !Number.isInteger(materialId) || materialId <= 0) notFound();
  const detail = await getMaterialDetail(r.id, materialId);
  if (!detail) notFound();
  const { material: m, versions, conversions, movements, units } = detail;
  const base = units.byCode.get(m.base_unit_code)!;
  const { reference, defaultEntry } = periodDates(ctx.period);
  const editable = canEdit(r.role) && m.active;
  const categories = editable ? await getCategories(r.id) : [];

  const costVersions = versions.map(toCostVersion);
  const current = effectiveVersion(costVersions, reference);
  const currentRow = current ? versions.find((v) => v.id === current.id)! : null;
  const rows = ledger(movements.map(toMovement));
  const balance = rows.at(-1);
  const options = purchaseOptions(base, units.enabled, conversions);
  const history = [...versions].sort((a, b) => (a.effective_on < b.effective_on ? -1 : a.effective_on > b.effective_on ? 1 : a.id - b.id));

  return (
    <>
      <Link href="/app/insumos" className="inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-bold text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Insumos
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-sm font-bold text-muted-foreground">{m.code}</p>
          <h1 className="font-brand text-3xl font-extrabold tracking-title text-heading sm:text-4xl">{materialName(m)}</h1>
          <p className="mt-2 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-card px-3 py-1 font-semibold text-ink-soft">{m.category}</span>
            <span className="rounded-full bg-card px-3 py-1 font-semibold text-ink-soft">Unidad base: {base.name}</span>
            <span className="rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand-700">{m.catalog_material_id ? "Catálogo general" : "Insumo propio"}</span>
            {!m.active && <span className="rounded-full bg-field px-3 py-1 font-bold text-muted-foreground">Archivado</span>}
          </p>
        </div>
      </div>

      {(sp.agregado || sp.creado) && (
        <p role="status" className="mt-4 rounded-xl bg-success-soft px-4 py-3 text-sm font-semibold text-success-text">
          {sp.agregado ? "Insumo agregado desde el catálogo con su precio de referencia." : "Insumo creado con su precio inicial."}
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat
          label={`Precio vigente al ${formatDate(reference)}`}
          value={current ? `${formatUnitPrice(versionResult(current), r.currency)} / ${base.symbol}` : "Sin precio"}
          note={currentRow ? `Desde ${formatDate(currentRow.effective_on)} · ${currentRow.source}` : "Registra un precio con vigencia hasta esa fecha."}
          tone={current ? undefined : "warn"}
        />
        <Stat
          label="Stock en kardex"
          value={balance ? (balance.value === null ? "Pendiente" : `${formatQty(balance.quantity)} ${base.symbol}`) : "Sin movimientos"}
          note={balance?.value ? `Valor ${formatMoney(balance.value, r.currency)}` : balance ? "Hay salidas mayores al stock registrado." : "Registra una compra para empezar el kardex."}
          tone={balance && balance.value === null ? "warn" : undefined}
        />
        <Stat
          label="Costo promedio ponderado"
          value={balance?.average && !balance.quantity.isZero() ? `${formatUnitPrice(balance.average, r.currency)} / ${base.symbol}` : "—"}
          note="Lo usan el plan y las ventas cuando hay kardex."
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-6">
          {editable && (
            <Section icon={Tag} title="Precio y compras">
              <MaterialActions
                materialId={m.id}
                options={options}
                baseSymbol={base.symbol}
                defaultDate={defaultEntry}
                token={crypto.randomUUID().replace(/-/g, "")}
                currency={r.currency}
              />
            </Section>
          )}

          <Section icon={History} title="Historial de precios" text="Cada versión es inmutable. El precio vigente es el de fecha más reciente hasta el día de referencia.">
            <PriceChart points={history.map((v) => ({ date: v.effective_on, value: versionResult(toCostVersion(v)) }))} currency={r.currency} />
            {history.length ? (
              <ul className="divide-y divide-line">
                {[...history].reverse().map((v) => {
                  const cv = toCostVersion(v);
                  const unitCost = versionResult(cv);
                  const purchase = v.mode === "purchase" && cv.mode === "purchase" ? acquisitionCost(cv.quantity, cv.factor, cv.netAmount, cv.nonrecoverableTax, cv.attributableCost, cv.recoverableTax) : null;
                  return (
                    <li key={v.id} className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3", current?.id === v.id && "rounded-xl bg-brand-50 px-3")}>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-heading">
                          {formatDate(v.effective_on)}
                          {current?.id === v.id && <span className="ml-2 text-xs font-bold text-primary">Vigente</span>}
                        </span>
                        <span className="block text-xs text-muted-foreground">{v.source}</span>
                        {purchase && (
                          <span className="block text-xs text-muted-foreground">
                            {formatQty(v.quantity)} {v.purchase_unit} · costo {formatMoney(purchase.acquisitionAmount, r.currency)} · IGV recuperable aparte {formatMoney(purchase.recoverableTax, r.currency)}
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-bold tabular-nums text-ink">
                        {formatUnitPrice(unitCost, r.currency)} / {base.symbol}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aún no hay precios.</p>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section icon={Ruler} title="Presentaciones" text={`Equivalencias propias de este insumo en ${base.name.toLowerCase()}s. No se editan: si cambian, crea otra.`}>
            {conversions.length ? (
              <ul className="mb-5 space-y-2">
                {conversions.map((c) => (
                  <li key={c.id} className="rounded-xl bg-surface px-4 py-3">
                    <span className="flex justify-between gap-3 text-sm font-bold text-heading">
                      <span>1 {c.label}</span>
                      <span className="tabular-nums">
                        {formatQty(c.factor, 6)} {base.symbol}
                      </span>
                    </span>
                    <span className="block text-xs text-muted-foreground">{c.evidence}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-5 text-sm text-muted-foreground">Sin presentaciones. Las unidades de la misma dimensión ya se convierten solas.</p>
            )}
            {editable && <ConversionForm materialId={m.id} baseSymbol={base.symbol} />}
          </Section>

          <Section icon={BookOpen} title="Datos del insumo">
            {editable ? (
              <MaterialDataForm
                material={{ id: m.id, code: m.code, name: m.name, variety: m.variety, category: m.category, supplier: m.supplier, fromCatalog: m.catalog_material_id !== null }}
                categories={categories}
              />
            ) : (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <dt className="text-muted-foreground">Proveedor</dt>
                <dd className="font-semibold">{m.supplier ?? "—"}</dd>
              </dl>
            )}
            {canEdit(r.role) && (
              <div className="mt-5 border-t border-line pt-4">
                <StatusButton materialId={m.id} active={m.active} />
              </div>
            )}
          </Section>
        </div>
      </div>

      <div className="mt-6">
        <Section icon={Boxes} id="kardex" title="Kardex" text="Promedio ponderado móvil: las entradas recalculan el promedio y las salidas salen al promedio vigente.">
          {rows.length ? (
            <div className="-mx-5 overflow-x-auto px-5 sm:-mx-7 sm:px-7">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-extrabold uppercase tracking-label text-muted-foreground">
                    <th className="py-2 pr-3 font-extrabold">Fecha</th>
                    <th className="py-2 pr-3 font-extrabold">Movimiento</th>
                    <th className="py-2 pr-3 text-right font-extrabold">Entrada</th>
                    <th className="py-2 pr-3 text-right font-extrabold">Salida</th>
                    <th className="py-2 pr-3 text-right font-extrabold">Costo unit.</th>
                    <th className="py-2 pr-3 text-right font-extrabold">Saldo</th>
                    <th className="py-2 text-right font-extrabold">Valor</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {[...rows].reverse().map((row) => {
                    const mv = row.movement;
                    const label = mv.reference.startsWith("Stock inicial")
                      ? "Stock inicial del catálogo"
                      : mv.sale_id
                        ? `Venta #${mv.sale_id}`
                        : mv.plan_id
                          ? `Plan de producción #${mv.plan_id}`
                          : mv.kind === "in"
                            ? "Compra"
                            : mv.reference;
                    return (
                      <tr key={mv.id} className={cn("border-b border-line-soft", mv.voided && "text-subtle line-through")}>
                        <td className="py-2.5 pr-3 whitespace-nowrap">{formatDate(mv.movement_on)}</td>
                        <td className="py-2.5 pr-3">{label}</td>
                        <td className="py-2.5 pr-3 text-right">{mv.kind === "in" ? formatQty(mv.quantity) : ""}</td>
                        <td className="py-2.5 pr-3 text-right">{mv.kind === "out" ? formatQty(mv.quantity) : ""}</td>
                        <td className="py-2.5 pr-3 text-right">{row.unitCost ? formatUnitPrice(row.unitCost, r.currency) : "—"}</td>
                        <td className="py-2.5 pr-3 text-right">
                          {formatQty(row.quantity)} {base.symbol}
                        </td>
                        <td className="py-2.5 text-right">{row.value === null ? <span className="text-warning-text">Pendiente</span> : formatMoney(row.value, r.currency)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin movimientos. Registra una compra para empezar.</p>
          )}
        </Section>
      </div>
    </>
  );
}
