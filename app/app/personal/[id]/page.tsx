import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CalendarDays, UserRound } from "lucide-react";
import { card } from "@/components/app/form";
import { DeleteEmployee, EmployeeForm, PayrollForm } from "@/components/app/personal/forms";
import { canEdit, getAppContext } from "@/lib/auth";
import { laborCost } from "@/lib/costing/costing";
import { payrollInput } from "@/lib/costing/planning";
import { getPeriodCosts, getRecipeOptions } from "@/lib/data/personal";
import { formatMoney } from "@/lib/format";
import { payrollFormValues } from "@/lib/personal";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "costea — Trabajador" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ mes?: string; nuevo?: string }> };

export default function TrabajadorPage(props: Props) {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<div className="h-[600px] animate-pulse rounded-[24px] bg-white" aria-busy="true" aria-label="Cargando" />}>
        <Detail {...props} />
      </Suspense>
    </div>
  );
}

async function Detail({ params, searchParams }: Props) {
  const [{ id }, sp, ctx] = await Promise.all([params, searchParams, getAppContext()]);
  const r = ctx.restaurant;
  const employeeId = Number(id);
  if (!r || !Number.isInteger(employeeId) || employeeId <= 0) notFound();
  const supabase = await createClient();
  const { data: employee } = await supabase.from("employees").select("id, name, role, document, active").eq("restaurant_id", r.id).eq("id", employeeId).maybeSingle();
  if (!employee) notFound();
  const [costs, recipes] = await Promise.all([getPeriodCosts(r.id), getRecipeOptions(r.id)]);
  const mine = costs.filter((c) => c.employee_id === employeeId);
  const period = ctx.periods.find((p) => p.id === Number(sp.mes)) ?? ctx.period;
  const record = period ? mine.find((c) => c.period_id === period.id) ?? null : null;
  const operations = recipes.reduce((n, x) => n + (x.work?.operations.filter((o) => o.employee_id === employeeId).length ?? 0), 0);
  const editable = canEdit(r.role);

  return (
    <>
      <Link href="/app/personal" className="inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-bold text-[#006b4b] hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Personal
      </Link>
      <div className="mt-2 flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-full bg-[#a9d63a] font-brand text-xl font-extrabold text-[#032a1f]">{employee.name.charAt(0)}</span>
        <div>
          <h1 className="font-brand text-3xl font-extrabold tracking-[-0.02em] text-[#032a1f]">{employee.name}</h1>
          <p className="text-[#5b6b65]">
            {employee.role}
            {!employee.active && " · Inactivo"}
          </p>
        </div>
      </div>
      {sp.nuevo && (
        <p role="status" className="mt-4 rounded-xl bg-[#e7f6ee] px-4 py-3 text-sm font-semibold text-[#00563d]">
          Trabajador registrado. Ahora registra su costo de {period?.label ?? "este mes"}.
        </p>
      )}

      <section className={cn(card, "mt-6 p-5 sm:p-7")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-brand text-xl font-extrabold text-[#032a1f]">Costo mensual</h2>
          <nav aria-label="Mes" className="flex flex-wrap gap-1">
            {ctx.periods.slice(0, 6).map((p) => {
              const saved = mine.some((c) => c.period_id === p.id);
              return (
                <Link
                  key={p.id}
                  href={`/app/personal/${employeeId}?mes=${p.id}`}
                  aria-current={p.id === period?.id ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold",
                    p.id === period?.id ? "bg-[#032a1f] text-white" : "text-[#3f524b] hover:bg-[#f6f9f7]",
                  )}
                >
                  <CalendarDays className="size-4" aria-hidden />
                  {p.label}
                  {saved && <span className="size-2 rounded-full bg-[#a9d63a]" aria-label="con costo" />}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-6">
          {!period ? (
            <p className="text-[#5b6b65]">Agrega un mes de trabajo en Configuración.</p>
          ) : editable ? (
            <PayrollForm
              key={`${period.id}-${record?.id ?? "nuevo"}`}
              employeeId={employeeId}
              periodId={period.id}
              periodLabel={period.label}
              initial={payrollFormValues(record)}
              currency={r.currency}
            />
          ) : record ? (
            <p className="font-bold">{formatMoney(laborCost(payrollInput({ employeeId, employee, data: record.data, breakdown: record.breakdown as never })).total, r.currency)}</p>
          ) : (
            <p className="text-[#5b6b65]">Sin costo registrado para {period.label}.</p>
          )}
        </div>
      </section>

      {editable && (
        <section className={cn(card, "mt-6 p-5 sm:p-7")}>
          <div className="flex items-center gap-2.5">
            <UserRound className="size-5 text-[#006b4b]" aria-hidden />
            <h2 className="font-brand text-xl font-extrabold text-[#032a1f]">Datos del trabajador</h2>
          </div>
          <div className="mt-5">
            <EmployeeForm employee={employee} />
          </div>
          <div className="mt-5 border-t border-[#e2e9e5] pt-4">
            <DeleteEmployee employeeId={employeeId} months={mine.length} operations={operations} />
          </div>
        </section>
      )}
    </>
  );
}
