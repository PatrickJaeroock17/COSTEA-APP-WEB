import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AlertTriangle, ArrowLeft, BookOpen, ChefHat, History, Pencil, Receipt, Scale } from "lucide-react";
import { QuickPriceCard } from "@/components/app/costos/quick-costs";
import { card } from "@/components/app/form";
import { IngredientForm, ProductDataForm, ProductStatus, RemoveIngredient, SalePriceForm, ScaleForm } from "@/components/app/platos/recipe-forms";
import { canEdit, getAppContext } from "@/lib/auth";
import { D, decimalText } from "@/lib/costing/decimal";
import { getIngredientChoices, getProductDetail } from "@/lib/data/products";
import { formatDate, formatMoney, formatQty, formatUnitPrice } from "@/lib/format";
import { limaToday } from "@/lib/materials";
import { QUANTITY_MODES, ratePercent } from "@/lib/recipes";
import { cn } from "@/lib/utils";
import { igvLabel } from "@/lib/restaurants";

export const metadata = { title: "costea — Plato" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ version?: string; creado?: string; catalogo?: string; fc?: string }> };

export default function PlatoPage(props: Props) {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<div className="h-[600px] animate-pulse rounded-3xl bg-card" aria-busy="true" aria-label="Cargando" />}>
        <Detail {...props} />
      </Suspense>
    </div>
  );
}

function Section({ icon: Icon, title, text, children, id }: { icon: typeof ChefHat; title: string; text?: string; children: React.ReactNode; id?: string }) {
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

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={cn(card, "p-5")}>
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 font-brand text-2xl font-extrabold tabular-nums text-heading">{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

const SOURCE_LABEL = { kardex: "Promedio kardex", version: "Precio de la receta", pending: "Kardex pendiente", catalog: "Precio de la receta" } as const;

async function Detail({ params, searchParams }: Props) {
  const [{ id }, sp, ctx] = await Promise.all([params, searchParams, getAppContext()]);
  const r = ctx.restaurant;
  const productId = Number(id);
  if (!r || !Number.isInteger(productId) || productId <= 0) notFound();
  const versionNumber = sp.version ? Number(sp.version) : null;
  const today = limaToday();
  const detail = await getProductDetail(r.id, productId, Number.isInteger(versionNumber) ? versionNumber : null, today);
  if (!detail) notFound();
  const { product: p, versions, version, isCurrent, cost, shortages, price } = detail;
  const editable = canEdit(r.role) && p.active && isCurrent;
  const ingredients = editable ? await getIngredientChoices(r.id, r.currency) : null;
  const choices = ingredients ? ingredients.choices.filter((c) => ingredients.active.has(c.id) || cost.lines.some((l) => l.material_id === c.id)) : [];
  const units = ingredients?.units.all ?? [];
  const net = price ? new D(price).div(new D(r.igvRate).plus(1)) : null;
  const foodCost = net && cost.perUnit ? cost.perUnit.div(net) : null;
  const portions = formatQty(version.output_quantity);

  return (
    <>
      <Link href="/app/platos" className="inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-bold text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Platos y recetas
      </Link>
      <div className="mt-2">
        <p className="text-xs font-bold uppercase tracking-label text-muted-foreground">{p.menu_category ?? "Sin categoría"}</p>
        <h1 className="font-brand text-3xl font-extrabold tracking-title text-heading sm:text-4xl">{isCurrent ? p.name : version.product_name}</h1>
        <p className="mt-2 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-card px-3 py-1 font-semibold text-ink-soft">
            Versión {version.number} · {formatDate(version.created_at)}
          </span>
          <span className="rounded-full bg-card px-3 py-1 font-semibold text-ink-soft">
            Rinde {portions} {Number(portions) === 1 ? "porción" : "porciones"}
          </span>
          {p.source_key && <span className="rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand-700">Receta del catálogo</span>}
          {!p.active && <span className="rounded-full bg-field px-3 py-1 font-bold text-muted-foreground">Archivado</span>}
        </p>
        {p.description && isCurrent && <p className="mt-3 max-w-3xl text-ink-soft">{p.description}</p>}
      </div>

      {(sp.creado || sp.catalogo) && (
        <p role="status" className="mt-4 rounded-xl bg-success-soft px-4 py-3 text-sm font-semibold text-success-text">
          {sp.catalogo ? "Plato traído del catálogo con sus insumos, mermas y precios." : "Plato creado. Agrega sus insumos y cantidades para calcular el costo."}
        </p>
      )}
      {!isCurrent && (
        <p className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-text">
          Estás viendo una versión anterior (solo lectura).
          <Link href={`/app/platos/${p.id}`} className="font-bold underline">
            Ir a la versión vigente
          </Link>
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Costo de materiales del lote" value={formatMoney(cost.total, r.currency)} note={cost.pricePending ? "Hay insumos con kardex pendiente." : "Sin IGV, al día de hoy."} />
        <Stat label="Materiales por porción" value={formatMoney(cost.perUnit, r.currency)} note="Mano de obra y gastos se suman en Costo y precio." />
        <Stat
          label="Precio de carta"
          value={price ? formatMoney(price, r.currency) : "Sin precio"}
          note={net ? `Sin IGV ${formatMoney(net, r.currency)}${foodCost ? ` · food cost ${foodCost.times(100).toDecimalPlaces(1).toFixed()} %` : ""}` : "Fíjalo abajo o en la pestaña Precios."}
        />
      </div>

      {isCurrent && (
        <div className="mt-4">
          <QuickPriceCard
            dish={{ id: p.id, name: p.name, category: p.menu_category, perUnit: cost.perUnit ? cost.perUnit.toFixed() : null, pending: cost.pricePending, current: price }}
            money={{ currency: r.currency, igvRate: r.igvRate, igvLabel: igvLabel(r.igvRate) }}
            initialTarget={sp.fc}
          />
        </div>
      )}

      {shortages.length > 0 && isCurrent && (
        <div className="mt-4 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-text">
          <p className="flex items-center gap-2 font-bold">
            <AlertTriangle className="size-4" aria-hidden />
            El inventario no alcanza para un lote hoy
          </p>
          <ul className="mt-1 list-disc pl-6">
            {shortages.map((s) => {
              const line = cost.lines.find((l) => String(l.material_id) === s.materialId);
              return (
                <li key={s.materialId}>
                  {line?.material_name}: faltan {formatQty(s.needed.minus(s.available), 4)} (hay {formatQty(s.available, 4)})
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {isCurrent && (
        <p className="mt-4 text-sm">
          <Link href={`/app/personal?tab=platos&plato=${p.id}`} className="font-bold text-primary underline">
            Ver o asignar la mano de obra de este plato
          </Link>
        </p>
      )}

      <div className="mt-6">
        <Section icon={ChefHat} title="Receta" text={`Cantidades para ${portions} ${Number(portions) === 1 ? "porción" : "porciones"}. Los importes no se redondean línea por línea.`}>
          {cost.lines.length ? (
            <div className="-mx-5 overflow-x-auto px-5 sm:-mx-7 sm:px-7">
              <table className="w-full min-w-[780px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-extrabold uppercase tracking-label text-muted-foreground">
                    <th className="py-2 pr-3 font-extrabold">Insumo</th>
                    <th className="py-2 pr-3 text-right font-extrabold">Cantidad</th>
                    <th className="py-2 pr-3 font-extrabold">Merma</th>
                    <th className="py-2 pr-3 text-right font-extrabold">Bruto (base)</th>
                    <th className="py-2 pr-3 text-right font-extrabold">Costo unitario</th>
                    <th className="py-2 text-right font-extrabold">Importe</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {cost.lines.map((l) => (
                    <tr key={l.id} className="border-b border-line-soft align-top">
                      <td className="py-3 pr-3">
                        <Link href={`/app/insumos/${l.material_id}`} className="font-bold text-heading hover:underline">
                          {l.material_name}
                        </Link>
                        {editable && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            <details className="group">
                              <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-primary hover:bg-brand-50">
                                <Pencil className="size-4" aria-hidden />
                                Editar
                              </summary>
                              <div className="mt-2 w-[min(640px,80vw)] rounded-2xl border border-line bg-surface p-4">
                                <IngredientForm
                                  productId={p.id}
                                  revision={p.revision}
                                  choices={choices}
                                  units={units}
                                  currency={r.currency}
                                  line={{
                                    materialId: l.material_id,
                                    costVersionId: l.cost_version_id,
                                    quantity: decimalText(l.quantity),
                                    unitKey: l.unit_key,
                                    unitLabel: l.unit_label,
                                    mode: l.mode,
                                    percent: ratePercent(l.rate),
                                  }}
                                />
                              </div>
                            </details>
                            <RemoveIngredient productId={p.id} revision={p.revision} materialId={l.material_id} name={l.material_name} />
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-right whitespace-nowrap">
                        {formatQty(l.quantity, 4)} {l.unit_label}
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap text-muted-foreground">
                        {l.mode === "gross" ? "Bruta" : `${QUANTITY_MODES.find((m) => m.value === l.mode)?.label.replace("Neta con ", "")} ${ratePercent(l.rate)} %`}
                      </td>
                      <td className="py-3 pr-3 text-right whitespace-nowrap">{formatQty(l.result.grossQuantity, 4)}</td>
                      <td className="py-3 pr-3 text-right whitespace-nowrap">
                        {formatUnitPrice(l.unitCost, r.currency)}
                        <span className="block text-xs text-muted-foreground">{SOURCE_LABEL[l.priceSource]}</span>
                      </td>
                      <td className="py-3 text-right font-bold whitespace-nowrap">{formatMoney(l.result.amount, r.currency, 4)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td className="py-3" colSpan={5}>
                      Total del lote
                    </td>
                    <td className="py-3 text-right">{formatMoney(cost.total, r.currency)}</td>
                  </tr>
                  <tr className="text-primary">
                    <td className="pb-1" colSpan={5}>
                      Por porción
                    </td>
                    <td className="pb-1 text-right font-extrabold">{formatMoney(cost.perUnit, r.currency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Esta versión no tiene insumos.</p>
          )}
          {editable && (
            <div className="mt-6 rounded-2xl bg-surface p-4 sm:p-5">
              <h3 className="mb-4 font-bold text-heading">Agregar insumo</h3>
              <IngredientForm productId={p.id} revision={p.revision} choices={choices} units={units} currency={r.currency} excluded={cost.lines.map((l) => l.material_id)} />
            </div>
          )}
        </Section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {editable && (
          <Section icon={Scale} title="Escalar la receta" text="Para cocinar otra cantidad de porciones. Exige que el inventario alcance para el nuevo lote.">
            <ScaleForm productId={p.id} revision={p.revision} output={portions} />
          </Section>
        )}
        {canEdit(r.role) && p.active && (
          <Section icon={Receipt} title="Precio de carta" text="Precio por porción que paga el cliente, con IGV. Se usa al registrar ventas.">
            <SalePriceForm productId={p.id} amount={price ? new D(price).toFixed(2) : null} currency={r.currency} igvLabel={igvLabel(r.igvRate)} />
          </Section>
        )}
        {editable && (
          <Section icon={BookOpen} title="Datos del plato">
            <ProductDataForm
              product={{ id: p.id, revision: p.revision, name: p.name, description: p.description, menuCategory: p.menu_category, output: decimalText(version.output_quantity) }}
            />
          </Section>
        )}
        <Section icon={History} title="Versiones" text="Cada versión guarda cantidades, precios y equivalencias tal como estaban.">
          <ul className="divide-y divide-line">
            {versions.map((v) => (
              <li key={v.id}>
                <Link
                  href={v.number === versions[0].number ? `/app/platos/${p.id}` : `/app/platos/${p.id}?version=${v.number}`}
                  aria-current={v.id === version.id ? "page" : undefined}
                  className={cn("flex min-h-12 items-center justify-between gap-3 rounded-xl px-3 text-sm hover:bg-surface", v.id === version.id && "bg-brand-50")}
                >
                  <span className="font-bold text-heading">
                    Versión {v.number}
                    {v.number === versions[0].number && <span className="ml-2 text-xs text-primary">Vigente</span>}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDate(v.created_at)} · rinde {formatQty(v.output_quantity)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {canEdit(r.role) && isCurrent && (
            <div className="mt-5 border-t border-line pt-4">
              <ProductStatus productId={p.id} revision={p.revision} active={p.active} />
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
