import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, ChevronRight, Users } from "lucide-react";
import { CreateRestaurant } from "@/components/app/create-restaurant";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { NewEmployee, OperationsEditor } from "@/components/app/personal/forms";
import { inputClass } from "@/components/auth/fields";
import { canEdit, getAppContext } from "@/lib/auth";
import { laborCost } from "@/lib/costing/costing";
import { sum } from "@/lib/costing/decimal";
import { recipeLaborTable, workerMinutes } from "@/lib/costing/labor";
import { getEmployees, getPeriodCosts, getRecipeOptions, staffInputs } from "@/lib/data/personal";
import { formatMoney, formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "costea — Personal" };

type Props = { searchParams: Promise<{ tab?: string; plato?: string; eliminado?: string }> };

export default function PersonalPage({ searchParams }: Props) {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<div className="h-[480px] animate-pulse rounded-3xl bg-card" aria-busy="true" aria-label="Cargando" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const TABS = [
  { key: "equipo", label: "Equipo y costo del mes" },
  { key: "minutos", label: "Minutos del mes" },
  { key: "platos", label: "Mano de obra por plato" },
] as const;

const th = "px-4 py-3 font-extrabold";

async function Content({ searchParams }: Props) {
  const [params, ctx] = await Promise.all([searchParams, getAppContext()]);
  if (!ctx.restaurant) return <CreateRestaurant name={ctx.user.name.split(" ")[0]} />;
  const r = ctx.restaurant;
  const tab = TABS.some((t) => t.key === params.tab) ? params.tab! : "equipo";
  const editable = canEdit(r.role);
  const [employees, costs] = await Promise.all([getEmployees(r.id), ctx.periodId ? getPeriodCosts(r.id, ctx.periodId) : Promise.resolve([])]);
  const staff = staffInputs(employees, costs);
  const staffOf = new Map(staff.map((s) => [Number(s.id), s]));
  const missing = employees.filter((e) => e.active && !staffOf.has(e.id));

  return (
    <>
      <PageHeader icon={Users} title="Personal" text={<>Costo mensual de cada trabajador en <strong>{ctx.period?.label ?? "el mes de trabajo"}</strong> y los minutos que dedica a cada plato.</>}>
        {editable && <NewEmployee />}
      </PageHeader>
      {params.eliminado && (
        <p role="status" className="mt-4 rounded-xl bg-success-soft px-4 py-3 text-sm font-semibold text-success-text">
          Trabajador eliminado.
        </p>
      )}
      <nav aria-label="Secciones de personal" className="mt-6 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1 rounded-2xl bg-card p-1.5">
          {TABS.map((t) => (
            <li key={t.key}>
              <Link
                href={`/app/personal?tab=${t.key}`}
                aria-current={tab === t.key ? "page" : undefined}
                className={cn("flex min-h-11 items-center whitespace-nowrap rounded-xl px-4 text-sm font-bold transition-colors", tab === t.key ? "bg-brand-900 text-white" : "text-ink-soft hover:bg-surface")}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {missing.length > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-text">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Falta el costo de {ctx.period?.label} de: {missing.map((e) => e.name).join(", ")}. El plan lo pedirá, incluso si es cero.
        </p>
      )}

      <div className="mt-6">
        {!employees.length ? (
          <EmptyState title="Aún no registras personal" text="Agrega a quienes cocinan, atienden o administran. Su costo mensual se reparte entre mano de obra directa y gastos." />
        ) : tab === "minutos" ? (
          <MinutesTab employees={employees} staffOf={staffOf} currency={r.currency} />
        ) : tab === "platos" ? (
          <DishesTab restaurantId={r.id} employees={employees} staff={staff} selected={Number(params.plato) || null} editable={editable} currency={r.currency} />
        ) : (
          <TeamTab employees={employees} staffOf={staffOf} currency={r.currency} />
        )}
      </div>
    </>
  );
}

type StaffMap = Map<number, Parameters<typeof laborCost>[0]>;

function TeamTab({ employees, staffOf, currency }: { employees: Awaited<ReturnType<typeof getEmployees>>; staffOf: StaffMap; currency: string }) {
  const results = new Map([...staffOf].map(([id, s]) => [id, laborCost(s)]));
  const all = [...results.values()];
  return (
    <>
      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        {[
          ["Planilla del mes", formatMoney(sum(all.map((x) => x.total)), currency)],
          ["Mano de obra directa", formatMoney(sum(all.map((x) => x.cost)), currency)],
          ["Pasa a CIF", formatMoney(sum(all.map((x) => x.indirect.cif)), currency)],
          ["Pasa a gastos", formatMoney(sum(all.map((x) => x.indirect.admin.plus(x.indirect.sales))), currency)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-3xl border border-line bg-card p-5">
            <p className="text-sm font-semibold text-muted-foreground">{k}</p>
            <p className="mt-1 font-brand text-2xl font-extrabold tabular-nums text-heading">{v}</p>
          </div>
        ))}
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {employees.map((e) => {
          const res = results.get(e.id);
          return (
            <li key={e.id}>
              <Link href={`/app/personal/${e.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface md:grid-cols-[1fr_150px_170px_24px]">
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-bold text-heading">{e.name}</span>
                    {!e.active && <span className="rounded-full bg-field px-2 py-0.5 text-xs font-bold text-muted-foreground">Inactivo</span>}
                  </span>
                  <span className="block text-xs text-muted-foreground">{e.role}</span>
                </span>
                <span className="text-right text-sm tabular-nums">
                  {res ? <span className="font-bold">{formatMoney(res.total, currency)}</span> : <span className="font-semibold text-warning-text">Sin costo del mes</span>}
                </span>
                <span className="col-span-2 text-sm text-muted-foreground md:col-span-1 md:text-right">
                  {res
                    ? res.directBasis === "quantity"
                      ? `Por porciones · ${res.unitRate ? formatMoney(res.unitRate, currency, 4) : "—"} c/u`
                      : res.rate
                        ? `${formatMoney(res.rate, currency, 4)} por minuto`
                        : "Sin minutos MOD"
                    : ""}
                </span>
                <ChevronRight className="hidden size-4 text-subtle md:block" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** legacy: worker_minutes — minutos programados, efectivos y costo por minuto antes del reparto. */
function MinutesTab({ employees, staffOf, currency }: { employees: Awaited<ReturnType<typeof getEmployees>>; staffOf: StaffMap; currency: string }) {
  const rows = employees.filter((e) => e.active || staffOf.has(e.id));
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <p className="border-b border-line bg-surface px-4 py-3 text-sm text-ink-soft">
        Costo por minuto = costo mensual ÷ minutos efectivos, antes de separar la parte directa e indirecta.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-label text-muted-foreground">
              <th className={th}>Trabajador</th>
              <th className={cn(th, "text-right")}>Costo mensual</th>
              <th className={cn(th, "text-right")}>Programados</th>
              <th className={cn(th, "text-right")}>Excluidos</th>
              <th className={cn(th, "text-right")}>Productivo</th>
              <th className={cn(th, "text-right")}>Efectivos</th>
              <th className={cn(th, "text-right")}>Costo / minuto</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((e) => {
              const s = staffOf.get(e.id);
              const m = s ? workerMinutes(s) : null;
              return (
                <tr key={e.id} className="border-b border-line-soft">
                  <td className="px-4 py-3">
                    <span className="font-bold text-heading">{e.name}</span>
                    <span className="block text-xs text-muted-foreground">{e.role}</span>
                  </td>
                  {m ? (
                    <>
                      <td className="px-4 py-3 text-right">{formatMoney(m.salary, currency)}</td>
                      <td className="px-4 py-3 text-right">{formatQty(m.programmed)}</td>
                      <td className="px-4 py-3 text-right">{formatQty(m.excluded)}</td>
                      <td className="px-4 py-3 text-right">{formatQty(m.productive.times(100), 2)} %</td>
                      <td className="px-4 py-3 text-right">{formatQty(m.effective, 2)}</td>
                      <td className="px-4 py-3 text-right font-bold">{m.rate ? formatMoney(m.rate, currency, 4) : "—"}</td>
                    </>
                  ) : (
                    <td colSpan={6} className="px-4 py-3 text-right font-semibold text-warning-text">
                      Falta el costo del mes
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** legacy: recipe_labor_table + operaciones de la receta. */
async function DishesTab({
  restaurantId,
  employees,
  staff,
  selected,
  editable,
  currency,
}: {
  restaurantId: string;
  employees: Awaited<ReturnType<typeof getEmployees>>;
  staff: Parameters<typeof recipeLaborTable>[1];
  selected: number | null;
  editable: boolean;
  currency: string;
}) {
  const recipes = await getRecipeOptions(restaurantId);
  if (!recipes.length) return <p className="text-muted-foreground">Primero crea o trae platos en Platos y recetas.</p>;
  const recipe = recipes.find((x) => x.productId === selected) ?? recipes[0];
  const operations = recipe.work?.operations ?? [];
  const table = recipeLaborTable(
    employees.map((e) => ({ id: e.id, name: e.name })),
    staff,
    recipe.output,
    recipe.work ? { operations: operations.map((o) => ({ employeeId: o.employee_id, activity: o.activity, minutes: o.minutes })), noLabor: recipe.work.no_labor } : null,
  );
  const names = Object.fromEntries(employees.map((e) => [e.id, e.name]));
  const involved = table.rows.filter((row) => !row.amount?.isZero() || row.minutes.gt(0));

  return (
    <div className="space-y-6">
      <form className="flex flex-col gap-3 sm:flex-row sm:items-end" role="search">
        <input type="hidden" name="tab" value="platos" />
        <label className="block flex-1 text-sm font-bold text-ink">
          Plato
          <select name="plato" defaultValue={recipe.productId} className={inputClass}>
            {recipes.map((x) => (
              <option key={x.productId} value={x.productId}>
                {x.name} · rinde {formatQty(x.output)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-12 rounded-xl bg-brand-900 px-5 text-sm font-extrabold text-white hover:bg-primary">
          Ver
        </button>
      </form>

      <section className="rounded-3xl border border-line bg-card p-5 sm:p-7">
        <h2 className="font-brand text-xl font-extrabold text-heading">Costos de mano de obra directa</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Versión {recipe.number} de la receta, lote de {formatQty(recipe.output)} {recipe.output === "1" ? "porción" : "porciones"}. Usa las tarifas del mes de trabajo.
        </p>
        {table.issues.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-text">
            {table.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        )}
        {involved.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-label text-muted-foreground">
                  <th className="py-2 pr-3 font-extrabold">Trabajador</th>
                  <th className="py-2 pr-3 text-right font-extrabold">Minutos del lote</th>
                  <th className="py-2 pr-3 text-right font-extrabold">Tarifa / minuto</th>
                  <th className="py-2 text-right font-extrabold">Importe</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {involved.map((row) => (
                  <tr key={row.employee.id} className="border-b border-line-soft">
                    <td className="py-2.5 pr-3">
                      {row.employee.name}
                      {row.note && <span className="block text-xs text-muted-foreground">{row.note}</span>}
                    </td>
                    <td className="py-2.5 pr-3 text-right">{formatQty(row.minutes, 2)}</td>
                    <td className="py-2.5 pr-3 text-right">{row.rate ? formatMoney(row.rate, currency, 4) : "—"}</td>
                    <td className="py-2.5 text-right font-bold">{row.amount ? formatMoney(row.amount, currency, 4) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <td className="py-3" colSpan={3}>
                    Total de mano de obra directa del lote
                  </td>
                  <td className="py-3 text-right">{table.total ? formatMoney(table.total, currency) : "—"}</td>
                </tr>
                <tr className="text-primary">
                  <td colSpan={3}>Por porción</td>
                  <td className="text-right font-extrabold">{table.perPortion ? formatMoney(table.perPortion, currency) : "—"}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-line bg-card p-5 sm:p-7">
        <h2 className="font-brand text-xl font-extrabold text-heading">Operaciones</h2>
        <p className="mb-5 mt-1 text-sm text-muted-foreground">Minutos para el lote completo. Si el mismo trabajador hace varias actividades, se suman sus tiempos sin duplicar su sueldo.</p>
        {editable ? (
          <OperationsEditor
            recipeId={recipe.recipeId}
            operations={operations}
            employees={employees.filter((e) => e.active)}
            names={names}
            flags={{ noMaterials: recipe.work?.no_materials ?? false, noLabor: recipe.work?.no_labor ?? false }}
            hasLines={recipe.lines > 0}
          />
        ) : (
          <ul className="space-y-2 text-sm">
            {operations.map((op, i) => (
              <li key={i}>
                {op.activity} · {names[op.employee_id]} · {formatQty(op.minutes, 2)} min
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
