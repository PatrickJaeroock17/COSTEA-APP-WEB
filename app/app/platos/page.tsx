import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, ChefHat } from "lucide-react";
import { CreateRestaurant } from "@/components/app/create-restaurant";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { CatalogDishes, NewProduct, PriceCell } from "@/components/app/platos/list-forms";
import { canEdit, getAppContext } from "@/lib/auth";
import { D } from "@/lib/costing/decimal";
import { type ProductSummary, getCatalogDishes, getProductSummaries } from "@/lib/data/products";
import { formatMoney, formatQty } from "@/lib/format";
import { limaToday } from "@/lib/materials";
import { cn } from "@/lib/utils";
import { igvLabel } from "@/lib/restaurants";

export const metadata = { title: "costea — Platos y recetas" };

type Props = { searchParams: Promise<{ tab?: string; estado?: string; eliminado?: string }> };

export default function PlatosPage({ searchParams }: Props) {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<div className="h-[480px] animate-pulse rounded-[24px] bg-white" aria-busy="true" aria-label="Cargando" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const TABS = [
  { key: "mios", label: "Mis platos" },
  { key: "precios", label: "Precios" },
  { key: "catalogo", label: "Catálogo de platos" },
] as const;

/** Food cost = costo de materiales por porción ÷ precio neto (sin IGV, con la tasa del restaurante). */
function foodCost(p: ProductSummary, igvRate: string) {
  if (!p.price || !p.cost.perUnit) return null;
  const net = new D(p.price).div(new D(igvRate).plus(1));
  return { net, ratio: p.cost.perUnit.div(net), margin: net.minus(p.cost.perUnit) };
}

const pct = (d: InstanceType<typeof D>) => `${d.times(100).toDecimalPlaces(1).toFixed()} %`;

async function Content({ searchParams }: Props) {
  const [params, ctx] = await Promise.all([searchParams, getAppContext()]);
  if (!ctx.restaurant) return <CreateRestaurant name={ctx.user.name.split(" ")[0]} />;
  const r = ctx.restaurant;
  const tab = TABS.some((t) => t.key === params.tab) ? params.tab! : "mios";
  const archived = params.estado === "archivados";
  const editable = canEdit(r.role);
  const today = limaToday();
  const products = await getProductSummaries(r.id, today);
  const active = products.filter((p) => p.active);
  const categories = [...new Set(products.map((p) => p.menu_category).filter(Boolean) as string[])].sort();

  return (
    <>
      <PageHeader icon={ChefHat} title="Platos y recetas" text="Cada cambio en una receta crea una versión nueva; las anteriores se conservan. El costo de materiales usa el promedio del kardex cuando existe.">
        {editable && <NewProduct categories={categories} />}
      </PageHeader>
      {params.eliminado && (
        <p role="status" className="mt-4 rounded-xl bg-success-soft px-4 py-3 text-sm font-semibold text-brand-700">
          Plato eliminado.
        </p>
      )}
      <nav aria-label="Secciones de platos" className="mt-6 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1 rounded-2xl bg-white p-1.5">
          {TABS.map((t) => (
            <li key={t.key}>
              <Link
                href={`/app/platos?tab=${t.key}`}
                aria-current={tab === t.key ? "page" : undefined}
                className={cn("flex min-h-11 items-center whitespace-nowrap rounded-xl px-4 text-sm font-bold transition-colors", tab === t.key ? "bg-brand-900 text-white" : "text-ink-soft hover:bg-surface")}
              >
                {t.label}
                {t.key === "mios" ? ` (${active.length})` : ""}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-6">
        {tab === "catalogo" ? (
          <CatalogTab products={products} editable={editable} currency={r.currency} />
        ) : tab === "precios" ? (
          <PricesTab products={active} editable={editable} currency={r.currency} igvRate={r.igvRate} />
        ) : (
          <MineTab products={products.filter((p) => p.active !== archived)} archived={archived} currency={r.currency} igvRate={r.igvRate} hasAny={products.length > 0} />
        )}
      </div>
    </>
  );
}

function MineTab({ products, archived, currency, igvRate, hasAny }: { products: ProductSummary[]; archived: boolean; currency: string; igvRate: string; hasAny: boolean }) {
  if (!hasAny) {
    return (
      <EmptyState icon={ChefHat} title="Aún no tienes platos" text="Trae un plato del catálogo con su receta lista o crea uno propio.">
        <Link href="/app/platos?tab=catalogo" className="inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-5 text-sm font-extrabold text-white">
          Ver catálogo de platos
        </Link>
      </EmptyState>
    );
  }
  return (
    <>
      <div className="mb-4 flex gap-2 text-sm">
        <Link href="/app/platos?tab=mios" className={cn("rounded-full px-3 py-1.5 font-bold", !archived ? "bg-brand-100 text-brand-700" : "text-muted-foreground hover:bg-white")}>
          Activos
        </Link>
        <Link href="/app/platos?tab=mios&estado=archivados" className={cn("rounded-full px-3 py-1.5 font-bold", archived ? "bg-brand-100 text-brand-700" : "text-muted-foreground hover:bg-white")}>
          Archivados
        </Link>
      </div>
      {!products.length ? (
        <p className="text-muted-foreground">{archived ? "No hay platos archivados." : "No hay platos activos."}</p>
      ) : (
        <ul className="cascade grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const fc = foodCost(p, igvRate);
            const empty = !p.cost.lines.length;
            return (
              <li key={p.id}>
                <Link href={`/app/platos/${p.id}`} className="card-hover flex h-full flex-col rounded-[24px] border border-line bg-white p-5">
                  <span className="text-xs font-bold uppercase tracking-[0.06em] text-muted-foreground">{p.menu_category ?? "Sin categoría"}</span>
                  <span className="mt-1 font-brand text-lg font-extrabold leading-snug text-heading">{p.name}</span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    Versión {p.version.number} · rinde {formatQty(p.version.output_quantity)} {p.version.output_quantity === "1" ? "porción" : "porciones"}
                    {p.source_key ? " · del catálogo" : ""}
                  </span>
                  <span className="mt-4 flex-1" />
                  {empty ? (
                    <span className="flex items-center gap-2 text-sm font-semibold text-warning-strong">
                      <AlertTriangle className="size-4" aria-hidden />
                      Sin insumos todavía
                    </span>
                  ) : (
                    <span className="grid grid-cols-2 gap-3 text-sm">
                      <span>
                        <span className="block text-xs text-muted-foreground">Materiales / porción</span>
                        <span className="font-bold tabular-nums text-ink">{formatMoney(p.cost.perUnit, currency)}</span>
                      </span>
                      <span>
                        <span className="block text-xs text-muted-foreground">Food cost</span>
                        <span className="font-bold tabular-nums text-ink">{fc ? pct(fc.ratio) : "Sin precio"}</span>
                      </span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function PricesTab({ products, editable, currency, igvRate }: { products: ProductSummary[]; editable: boolean; currency: string; igvRate: string }) {
  if (!products.length) return <p className="text-muted-foreground">Agrega platos para fijar sus precios de carta.</p>;
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <p className="border-b border-line bg-surface px-4 py-3 text-sm text-ink-soft">
        Precio de carta con IGV {igvLabel(igvRate)}. El food cost compara el costo de materiales por porción con el precio sin IGV. El costo completo (mano de obra y gastos) se calcula en Costo y
        precio por plato.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-extrabold uppercase tracking-[0.06em] text-muted-foreground">
              <th className="px-4 py-3 font-extrabold">Plato</th>
              <th className="px-4 py-3 text-right font-extrabold">Materiales / porción</th>
              <th className="px-4 py-3 text-right font-extrabold">Precio con IGV</th>
              <th className="px-4 py-3 text-right font-extrabold">Sin IGV</th>
              <th className="px-4 py-3 text-right font-extrabold">Food cost</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {products.map((p) => {
              const fc = foodCost(p, igvRate);
              return (
                <tr key={p.id} className="border-b border-line-soft align-top">
                  <td className="px-4 py-3">
                    <Link href={`/app/platos/${p.id}`} className="font-bold text-heading hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">{p.cost.perUnit ? formatMoney(p.cost.perUnit, currency) : "—"}</td>
                  <td className="px-4 py-2">
                    <PriceCell productId={p.id} amount={p.price ? new D(p.price).toFixed(2) : null} currency={currency} editable={editable} />
                  </td>
                  <td className="px-4 py-3 text-right">{fc ? formatMoney(fc.net, currency) : "—"}</td>
                  <td className="px-4 py-3 text-right font-bold">{fc ? pct(fc.ratio) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function CatalogTab({ products, editable, currency }: { products: ProductSummary[]; editable: boolean; currency: string }) {
  const dishes = await getCatalogDishes();
  const mine = new Map(products.filter((p) => p.source_key?.startsWith("catalogo:")).map((p) => [Number(p.source_key!.split(":")[1]), p.id]));
  const blocked = currency !== "PEN" ? "Las recetas del catálogo usan precios en soles; este restaurante trabaja en otra moneda." : undefined;
  return <CatalogDishes dishes={dishes.map((d) => ({ ...d, portions: formatQty(d.portions), mine: mine.get(d.id) ?? null }))} canAdd={editable && !blocked} blockedReason={blocked} />;
}
