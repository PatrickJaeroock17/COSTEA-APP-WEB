import Link from "next/link";
import { Suspense } from "react";
import { Building2, CalendarDays, Lock, Ruler, Settings, Store } from "lucide-react";
import { CreateRestaurant } from "@/components/app/create-restaurant";
import { card } from "@/components/app/form";
import { RestaurantForm } from "@/components/app/settings/restaurant-form";
import { PeriodForm } from "@/components/app/settings/period-form";
import { UnitsForm } from "@/components/app/settings/units-form";
import { RestaurantList } from "@/components/app/settings/restaurant-list";
import { type AppContext, canEdit, getAppContext } from "@/lib/auth";
import { displayName, periodKey } from "@/lib/restaurants";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "costea — Configuración" };

const SECTIONS = [
  { key: "restaurante", label: "Restaurante", icon: Building2 },
  { key: "periodos", label: "Meses de trabajo", icon: CalendarDays },
  { key: "unidades", label: "Unidades", icon: Ruler },
  { key: "restaurantes", label: "Mis restaurantes", icon: Store },
] as const;
type Section = (typeof SECTIONS)[number]["key"];

type Props = { searchParams: Promise<{ seccion?: string; creado?: string }> };

export default function ConfiguracionPage({ searchParams }: Props) {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-[#006b4b] text-[#a9d63a]">
          <Settings className="size-6" aria-hidden />
        </span>
        <h1 className="font-brand text-3xl font-extrabold tracking-[-0.02em] text-[#032a1f] sm:text-4xl">Configuración</h1>
      </div>
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-[24px] bg-white" aria-busy="true" aria-label="Cargando" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** Mes actual en Perú como AAAA-MM. */
function limaMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}

/** Mes sugerido para agregar: el actual si falta; si no, el siguiente al más reciente. */
function suggestedMonth(periods: AppContext["periods"]) {
  const current = limaMonth();
  const keys = new Set(periods.map((p) => periodKey(p.year, p.month)));
  if (!keys.has(current) || !periods.length) return current;
  const latest = periods[0];
  return latest.month === 12 ? periodKey(latest.year + 1, 1) : periodKey(latest.year, latest.month + 1);
}

async function Content({ searchParams }: Props) {
  const [{ seccion, creado }, ctx] = await Promise.all([searchParams, getAppContext()]);
  const section: Section = SECTIONS.some((s) => s.key === seccion) ? (seccion as Section) : "restaurante";

  if (!ctx.restaurant && section !== "restaurantes") {
    return (
      <div className="mt-8">
        <CreateRestaurant name={ctx.user.name.split(" ")[0]} />
      </div>
    );
  }

  return (
    <>
      <nav aria-label="Secciones de configuración" className="mt-6 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1 rounded-2xl bg-white p-1.5 sm:w-auto">
          {SECTIONS.map(({ key, label, icon: Icon }) => (
            <li key={key}>
              <Link
                href={`/app/configuracion?seccion=${key}`}
                aria-current={section === key ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition-colors",
                  section === key ? "bg-[#032a1f] text-white" : "text-[#3f524b] hover:bg-[#f6f9f7]",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-6">
        {section === "restaurante" && <RestaurantSection ctx={ctx} created={creado === "1"} />}
        {section === "periodos" && <PeriodsSection ctx={ctx} />}
        {section === "unidades" && <UnitsSection ctx={ctx} />}
        {section === "restaurantes" && <RestaurantsSection ctx={ctx} />}
      </div>
    </>
  );
}

function SectionCard({ title, text, children }: { title: string; text?: string; children: React.ReactNode }) {
  return (
    <section className={cn(card, "p-6 sm:p-8")}>
      <h2 className="font-brand text-xl font-extrabold text-[#032a1f]">{title}</h2>
      {text && <p className="mt-1 text-[#5b6b65]">{text}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function ReadOnlyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-5 flex items-center gap-2 rounded-xl bg-[#f6f9f7] px-4 py-3 text-sm text-[#3f524b]">
      <Lock className="size-4 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

async function RestaurantSection({ ctx, created }: { ctx: AppContext; created: boolean }) {
  const r = ctx.restaurant!;
  const supabase = await createClient();
  const { data: locked } = await supabase.rpc("restaurant_money_data", { rid: r.id });
  const owner = r.role === "owner";
  return (
    <SectionCard title="Datos del restaurante" text="Se usan en los reportes y presupuestos. Los cambios no alteran los meses ya creados.">
      {created && (
        <p role="status" className="mb-5 rounded-xl bg-[#e7f6ee] px-4 py-3 text-sm font-semibold text-[#00563d]">
          Restaurante creado con su primer mes de trabajo. Ya puedes registrar insumos.
        </p>
      )}
      {!owner && <ReadOnlyNote>Solo el dueño puede cambiar estos datos.</ReadOnlyNote>}
      <RestaurantForm
        key={r.id}
        mode="edit"
        readOnly={!owner}
        currencyLocked={Boolean(locked)}
        initial={{ legalName: r.legalName, tradeName: r.tradeName ?? "", taxIdKind: r.taxIdKind, taxId: r.taxId ?? "", currency: r.currency }}
      />
    </SectionCard>
  );
}

function PeriodsSection({ ctx }: { ctx: AppContext }) {
  const editable = canEdit(ctx.restaurant?.role);
  return (
    <div className="space-y-6">
      {editable && (
        <SectionCard title="Agregar un mes" text="Cada mes guarda su propio costo de personal, gastos, plan y presupuesto. IGV 18 %.">
          <PeriodForm key={ctx.periods.length} defaultMonth={suggestedMonth(ctx.periods)} />
        </SectionCard>
      )}
      <SectionCard title="Meses del restaurante" text="Elige el mes de trabajo en el selector de arriba.">
        {ctx.periods.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ctx.periods.map((p) => (
              <li
                key={p.id}
                className={cn(
                  "flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-4",
                  p.id === ctx.periodId ? "border-[#006b4b]/40 bg-[#ecf8f2]" : "border-[#e2e9e5]",
                )}
              >
                <span className="font-bold text-[#032a1f]">{p.label}</span>
                <span className="text-sm text-[#5b6b65]">{p.id === ctx.periodId ? "Mes de trabajo" : "IGV 18 %"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[#5b6b65]">Aún no hay meses. Agrega el primero arriba.</p>
        )}
      </SectionCard>
    </div>
  );
}

async function UnitsSection({ ctx }: { ctx: AppContext }) {
  const supabase = await createClient();
  const [{ data: units }, { data: settings }] = await Promise.all([
    supabase.from("units").select("code, name, symbol, dimension, numerator"),
    supabase.from("restaurant_units").select("unit_code, enabled").eq("restaurant_id", ctx.restaurant!.id),
  ]);
  // Sin configuración guardada, todas están disponibles (legacy: units()).
  const saved = new Map((settings ?? []).map((s) => [s.unit_code, s.enabled]));
  const options = (units ?? [])
    .sort((a, b) => a.dimension.localeCompare(b.dimension) || a.numerator - b.numerator)
    .map((u) => ({ code: u.code, name: u.name, symbol: u.symbol, dimension: u.dimension, enabled: saved.size ? saved.get(u.code) === true : true }));
  const editable = canEdit(ctx.restaurant?.role);
  return (
    <SectionCard title="Unidades de medida" text="Las unidades marcadas aparecen al registrar insumos y recetas. Las conversiones son exactas (1 kg = 1000 g).">
      {!editable && <ReadOnlyNote>Solo el dueño o un editor puede cambiar las unidades.</ReadOnlyNote>}
      <UnitsForm units={options} readOnly={!editable} />
    </SectionCard>
  );
}

async function RestaurantsSection({ ctx }: { ctx: AppContext }) {
  const supabase = await createClient();
  const [{ data: all }, { data: members }] = await Promise.all([
    supabase.from("restaurants").select("id, legal_name, trade_name, active").order("active", { ascending: false }).order("created_at"),
    supabase.from("restaurant_members").select("restaurant_id, role").eq("user_id", ctx.user.id),
  ]);
  const roles = new Map((members ?? []).map((m) => [m.restaurant_id, m.role]));
  const items = (all ?? []).map((r) => ({
    id: r.id,
    name: displayName(r),
    legalName: r.legal_name,
    active: r.active,
    owner: roles.get(r.id) === "owner",
    current: r.id === ctx.restaurantId,
  }));
  return (
    <div className="space-y-6">
      <SectionCard title="Mis restaurantes" text="Archivar oculta un restaurante sin borrar sus datos.">
        {items.length ? <RestaurantList items={items} /> : <p className="text-[#5b6b65]">Aún no tienes restaurantes.</p>}
      </SectionCard>
      <SectionCard title="Nuevo restaurante" text="Se crea con su primer mes de trabajo y queda seleccionado.">
        <RestaurantForm mode="create" defaultMonth={limaMonth()} />
      </SectionCard>
    </div>
  );
}
