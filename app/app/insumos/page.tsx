import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, ChevronRight, Package, Search } from "lucide-react";
import { CreateRestaurant } from "@/components/app/create-restaurant";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { CatalogList } from "@/components/app/insumos/catalog-list";
import { NewMaterial } from "@/components/app/insumos/new-material";
import { inputClass } from "@/components/auth/fields";
import { canEdit, getAppContext } from "@/lib/auth";
import { getCatalog, getCategories, getMaterialSummaries, getUnits } from "@/lib/data/materials";
import { formatDate, formatMoney, formatQty, formatUnitPrice } from "@/lib/format";
import { materialName, periodDates } from "@/lib/materials";
import { createClient } from "@/lib/supabase/server";
import { sum } from "@/lib/costing/decimal";
import { cn } from "@/lib/utils";

export const metadata = { title: "costea — Insumos" };

type Search = { tab?: string; q?: string; estado?: string };
type Props = { searchParams: Promise<Search> };

export default function InsumosPage({ searchParams }: Props) {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<div className="h-[480px] animate-pulse rounded-[24px] bg-white" aria-busy="true" aria-label="Cargando" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

async function Content({ searchParams }: Props) {
  const [params, ctx] = await Promise.all([searchParams, getAppContext()]);
  if (!ctx.restaurant) return <CreateRestaurant name={ctx.user.name.split(" ")[0]} />;
  const r = ctx.restaurant;
  const tab = params.tab === "catalogo" ? "catalogo" : "mios";
  const status = ["activos", "archivados", "todos"].includes(params.estado ?? "") ? params.estado! : "activos";
  const query = (params.q ?? "").trim().slice(0, 180);
  const { reference, defaultEntry } = periodDates(ctx.period);
  const editable = canEdit(r.role);

  const supabase = await createClient();
  const [summaries, categories, units] = await Promise.all([
    getMaterialSummaries(r.id, reference),
    editable ? getCategories(r.id) : Promise.resolve([]),
    getUnits(supabase, r.id),
  ]);

  const tabLink = (key: string) => `/app/insumos?tab=${key}`;
  return (
    <>
      <PageHeader
        icon={Package}
        title="Insumos"
        text={
          <>
            Precios vigentes al <strong>{formatDate(reference)}</strong> (fin del mes de trabajo), sin IGV. Cada cambio de precio se guarda como una versión nueva.
          </>
        }
      >
        {editable && (
          <NewMaterial
            categories={categories}
            units={units.enabled.map((u) => ({ code: u.code, label: `${u.name} (${u.symbol})` }))}
            defaultDate={defaultEntry}
            currency={r.currency}
          />
        )}
      </PageHeader>

      <nav aria-label="Origen de los insumos" className="mt-6">
        <ul className="flex w-max gap-1 rounded-2xl bg-white p-1.5">
          {[
            { key: "mios", label: `Mis insumos (${summaries.filter((m) => m.active).length})` },
            { key: "catalogo", label: "Catálogo general" },
          ].map((t) => (
            <li key={t.key}>
              <Link
                href={tabLink(t.key)}
                aria-current={tab === t.key ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-xl px-4 text-sm font-bold transition-colors",
                  tab === t.key ? "bg-[#032a1f] text-white" : "text-[#3f524b] hover:bg-[#f6f9f7]",
                )}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6">
        {tab === "catalogo" ? (
          <CatalogSection restaurantCurrency={r.currency} editable={editable} mine={summaries} />
        ) : (
          <MineSection summaries={summaries} query={query} status={status} currency={r.currency} units={units.byCode} />
        )}
      </div>
    </>
  );
}

function MineSection({
  summaries,
  query,
  status,
  currency,
  units,
}: {
  summaries: Awaited<ReturnType<typeof getMaterialSummaries>>;
  query: string;
  status: string;
  currency: string;
  units: Map<string, { symbol: string }>;
}) {
  const needle = fold(query);
  const rows = summaries.filter(
    (m) =>
      (status === "todos" || m.active === (status === "activos")) &&
      (!needle || fold(`${m.code} ${m.name} ${m.variety ?? ""} ${m.category} ${m.supplier ?? ""}`).includes(needle)),
  );
  const withoutPrice = summaries.filter((m) => m.active && !m.price).length;

  return (
    <>
      <form className="flex flex-col gap-3 sm:flex-row" role="search">
        <input type="hidden" name="tab" value="mios" />
        <label className="relative flex-1">
          <span className="sr-only">Buscar insumos</span>
          <Search className="pointer-events-none absolute left-4 top-[30px] size-4 -translate-y-1/2 text-[#5b6b65]" aria-hidden />
          <input name="q" defaultValue={query} placeholder="Buscar por nombre, código, categoría o proveedor" className={cn(inputClass, "pl-11")} />
        </label>
        <label className="sm:w-48">
          <span className="sr-only">Estado</span>
          <select name="estado" defaultValue={status} className={inputClass}>
            <option value="activos">Activos</option>
            <option value="archivados">Archivados</option>
            <option value="todos">Todos</option>
          </select>
        </label>
        <button type="submit" className="mt-1.5 h-12 rounded-xl bg-[#032a1f] px-5 text-sm font-extrabold text-white hover:bg-[#006b4b]">
          Buscar
        </button>
      </form>

      {withoutPrice > 0 && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-[#fff6e5] px-4 py-3 text-sm text-[#7a4b00]">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          {withoutPrice === 1 ? "1 insumo no tiene" : `${withoutPrice} insumos no tienen`} precio vigente a esta fecha.
        </p>
      )}

      {!summaries.length ? (
        <div className="mt-6">
          <EmptyState title="Aún no tienes insumos" text="Agrégalos desde el catálogo general o crea uno propio con su precio.">
            <Link href="/app/insumos?tab=catalogo" className="inline-flex min-h-11 items-center rounded-xl bg-[#006b4b] px-5 text-sm font-extrabold text-white">
              Ver catálogo general
            </Link>
          </EmptyState>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#e2e9e5] bg-white">
          <div className="hidden grid-cols-[88px_1fr_150px_150px_28px] gap-4 border-b border-[#e2e9e5] bg-[#f6f9f7] px-4 py-3 text-xs font-extrabold uppercase tracking-[0.06em] text-[#5b6b65] md:grid">
            <span>Código</span>
            <span>Insumo</span>
            <span className="text-right">Precio vigente</span>
            <span className="text-right">Stock</span>
            <span />
          </div>
          <ul className="divide-y divide-[#e2e9e5]">
            {rows.map((m) => {
              const unit = units.get(m.base_unit_code)?.symbol ?? m.base_unit_code;
              return (
                <li key={m.id}>
                  <Link
                    href={`/app/insumos/${m.id}`}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-[#f6f9f7] md:grid-cols-[88px_1fr_150px_150px_28px]"
                  >
                    <span className="order-2 font-mono text-xs font-bold text-[#5b6b65] md:order-none">{m.code}</span>
                    <span className="order-1 col-span-2 min-w-0 md:order-none md:col-span-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-bold text-[#032a1f]">{materialName(m)}</span>
                        {!m.active && <span className="rounded-full bg-[#f2f5f3] px-2 py-0.5 text-xs font-bold text-[#5b6b65]">Archivado</span>}
                      </span>
                      <span className="block truncate text-xs text-[#5b6b65]">
                        {m.category}
                        {m.catalog_material_id ? " · Catálogo" : " · Propio"}
                      </span>
                    </span>
                    <span className="order-3 text-right text-sm tabular-nums md:order-none">
                      {m.price ? (
                        <>
                          <span className="font-bold text-[#12251f]">{formatUnitPrice(m.price, currency)}</span>
                          <span className="text-[#5b6b65]"> / {unit}</span>
                        </>
                      ) : (
                        <span className="font-semibold text-[#9b5c00]">Sin precio</span>
                      )}
                    </span>
                    <span className="order-4 hidden text-right text-sm tabular-nums text-[#3f524b] md:block">
                      {m.pending ? <span className="text-[#9b5c00]">Pendiente</span> : m.stock ? `${formatQty(m.stock)} ${unit}` : "—"}
                    </span>
                    <ChevronRight className="hidden size-4 text-[#8a9a93] md:block" aria-hidden />
                  </Link>
                </li>
              );
            })}
            {!rows.length && <li className="px-4 py-8 text-center text-sm text-[#5b6b65]">Ningún insumo coincide con la búsqueda.</li>}
          </ul>
        </div>
      )}
      <p className="mt-3 text-xs text-[#5b6b65]">
        Valor del stock al promedio ponderado:{" "}
        {formatMoney(sum(summaries.filter((m) => m.active && m.stock && m.average).map((m) => m.stock!.times(m.average!))), currency)}
      </p>
    </>
  );
}

async function CatalogSection({
  restaurantCurrency,
  editable,
  mine,
}: {
  restaurantCurrency: string;
  editable: boolean;
  mine: { id: number; catalog_material_id: number | null }[];
}) {
  const catalog = await getCatalog();
  const byCatalog = new Map(mine.filter((m) => m.catalog_material_id).map((m) => [m.catalog_material_id!, m.id]));
  const rows = catalog.map((c) => ({
    id: c.id_insumo,
    code: c.codigo_comercial,
    name: c.variedad ? `${c.nombre} ${c.variedad}` : c.nombre,
    category: c.categoria,
    unit: c.unidad,
    price: formatMoney(c.precio_mayorista, "PEN"),
    active: c.activo,
    mine: byCatalog.get(c.id_insumo) ?? null,
  }));
  const blocked = restaurantCurrency !== "PEN" ? "Los precios del catálogo están en soles; este restaurante trabaja en otra moneda. Crea tus insumos como propios." : undefined;
  return <CatalogList rows={rows} canAdd={editable && !blocked} blockedReason={blocked} />;
}
