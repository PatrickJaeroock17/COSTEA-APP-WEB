"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { Dialog } from "@/components/app/dialog";
import { Field, FormAlert, SaveButton } from "@/components/app/form";
import {
  addOperation,
  createEmployee,
  deleteEmployee,
  type PersonalState,
  removeOperation,
  savePayroll,
  setRecipeWork,
  updateEmployee,
} from "@/lib/actions/personal";
import { BASIS, CONSOLIDATED, DETAILED, type PayrollFormValues, parsePayroll } from "@/lib/personal";
import { formatMoney, formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ───────────── Trabajador ───────────── */

export function NewEmployee() {
  const [state, action] = useActionState<PersonalState, FormData>(createEmployee, {});
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  return (
    <Dialog label="Nuevo trabajador" icon={UserPlus} title="Nuevo trabajador" text="Luego registras su costo mensual y los minutos que dedica a cada plato." open={state.error}>
      <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Nombre completo" name="name" error={e.name} className="sm:col-span-2">
          {(p) => <input {...p} name="name" required maxLength={180} defaultValue={v.name} autoFocus />}
        </Field>
        <Field label="Cargo" name="role" error={e.role}>
          {(p) => <input {...p} name="role" required maxLength={180} defaultValue={v.role} placeholder="Cocinero" />}
        </Field>
        <Field label="Documento (opcional)" name="document" error={e.document} hint="Distingue a personas con el mismo nombre.">
          {(p) => <input {...p} name="document" maxLength={40} defaultValue={v.document} placeholder="DNI" />}
        </Field>
        <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
          <SaveButton>Registrar trabajador</SaveButton>
          <FormAlert error={state.error} />
        </div>
      </form>
    </Dialog>
  );
}

export function EmployeeForm({ employee }: { employee: { id: number; name: string; role: string; document: string | null; active: boolean } }) {
  const [state, action] = useActionState<PersonalState, FormData>(updateEmployee, {});
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <input type="hidden" name="employeeId" value={employee.id} />
      <Field label="Nombre completo" name="name" error={e.name} className="sm:col-span-2">
        {(p) => <input {...p} name="name" maxLength={180} defaultValue={v.name ?? employee.name} />}
      </Field>
      <Field label="Cargo" name="role" error={e.role}>
        {(p) => <input {...p} name="role" maxLength={180} defaultValue={v.role ?? employee.role} />}
      </Field>
      <Field label="Documento (opcional)" name="document" error={e.document}>
        {(p) => <input {...p} name="document" maxLength={40} defaultValue={v.document ?? employee.document ?? ""} />}
      </Field>
      <label className="flex min-h-11 items-center gap-3 text-sm font-bold text-[#12251f] sm:col-span-2">
        <input type="checkbox" name="active" defaultChecked={v.active ? v.active === "on" : employee.active} className="size-5 accent-[#006b4b]" />
        Activo (si lo desactivas, ya no aparece al asignar operaciones)
      </label>
      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
        <SaveButton>Guardar datos</SaveButton>
        <FormAlert error={state.error} message={state.message} />
      </div>
    </form>
  );
}

export function DeleteEmployee({ employeeId, months, operations }: { employeeId: number; months: number; operations: number }) {
  const [state, action] = useActionState<PersonalState, FormData>(deleteEmployee, {});
  const [confirm, setConfirm] = useState(false);
  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold text-[#9b2c2c] hover:bg-[#fdecec]">
        <Trash2 className="size-4" aria-hidden />
        Eliminar trabajador
      </button>
    );
  }
  return (
    <form action={action} className="rounded-xl bg-[#fdecec] p-4">
      <input type="hidden" name="employeeId" value={employeeId} />
      <p className="text-sm text-[#7f2424]">
        Se borran sus {months} {months === 1 ? "costo mensual" : "costos mensuales"} y {operations} {operations === 1 ? "operación" : "operaciones"} en recetas. Los presupuestos publicados no
        cambian. Si solo dejó de trabajar, mejor desactívalo.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <SaveButton className="min-h-10 bg-[#9b2c2c] px-4 text-sm hover:bg-[#7f2424]">Sí, eliminar</SaveButton>
        <button type="button" onClick={() => setConfirm(false)} className="min-h-10 rounded-xl px-3 text-sm font-bold text-[#5b6b65] hover:bg-white">
          Cancelar
        </button>
      </div>
      {state.error && (
        <div className="mt-3">
          <FormAlert error={state.error} />
        </div>
      )}
    </form>
  );
}

/* ───────────── Costo mensual ───────────── */

function Num({ name, label, values, set, errors, hint, suffix }: { name: string; label: string; values: PayrollFormValues; set: (k: string, v: string) => void; errors: Record<string, string>; hint?: string; suffix?: string }) {
  return (
    <Field label={suffix ? `${label} (${suffix})` : label} name={name} error={errors[name]} hint={hint}>
      {(p) => <input {...p} name={name} inputMode="decimal" value={values[name] ?? ""} onChange={(ev) => set(name, ev.target.value)} />}
    </Field>
  );
}

function Group({ title, children, text }: { title: string; text?: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-[#e2e9e5] p-4 sm:p-5">
      <legend className="px-1 text-sm font-extrabold text-[#032a1f]">{title}</legend>
      {text && <p className="-mt-1 mb-3 text-xs text-[#5b6b65]">{text}</p>}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function PayrollForm({ employeeId, periodId, periodLabel, initial, currency }: { employeeId: number; periodId: number; periodLabel: string; initial: PayrollFormValues; currency: string }) {
  const [state, action] = useActionState<PersonalState, FormData>(savePayroll, {});
  const [values, setValues] = useState<PayrollFormValues>(state.values ?? initial);
  const set = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));
  const preview = useMemo(() => parsePayroll(values), [values]);
  const errors = { ...(state.fieldErrors ?? {}) };
  const detailed = values.mode !== "consolidated";
  const r = "ok" in preview ? preview.ok.result : null;
  const select = (name: string, options: readonly { value: string; label: string }[], label: string) => (
    <Field label={label} name={name} error={errors[name]}>
      {(p) => (
        <select {...p} name={name} value={values[name]} onChange={(ev) => set(name, ev.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_300px]" noValidate>
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="periodId" value={periodId} />
      <div className="space-y-5">
        <div role="radiogroup" aria-label="Cálculo de planilla" className="flex flex-wrap gap-2">
          {[
            { value: "detailed", label: "Desglose de sueldo, beneficios y seguros" },
            { value: "consolidated", label: "Importes mensuales consolidados" },
          ].map((m) => (
            <label key={m.value} className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-bold", values.mode === m.value || (m.value === "detailed" && detailed) ? "border-[#006b4b] bg-[#ecf8f2] text-[#006b4b]" : "border-[#e2e9e5] text-[#3f524b]")}>
              <input type="radio" name="mode" value={m.value} checked={m.value === "detailed" ? detailed : !detailed} onChange={() => set("mode", m.value)} className="sr-only" />
              {m.label}
            </label>
          ))}
        </div>

        {detailed ? (
          <Group title="Planilla" text="Beneficios anuales se provisionan en 12 meses. Bases y tasas explícitas; el crédito EPS se resta una sola vez.">
            {DETAILED.map((f) => (
              <Num key={f.key} name={f.key} label={f.label} values={values} set={set} errors={errors} hint={f.hint} suffix={f.key.endsWith("percent") ? undefined : currency} />
            ))}
          </Group>
        ) : (
          <Group title="Importes mensuales">
            {CONSOLIDATED.map((c) => (
              <Num key={c.key} name={c.key} label={c.label} values={values} set={set} errors={errors} suffix={currency} />
            ))}
          </Group>
        )}
        <Field label="Sustento y composición de los importes" name="source" error={errors.source}>
          {(p) => <input {...p} name="source" maxLength={500} value={values.source} onChange={(ev) => set("source", ev.target.value)} placeholder="Contrato vigente y boletas de octubre" />}
        </Field>

        <Group title="Tiempo del mes" text="Minutos efectivos = (días × horas × 60 − excluidos) × factor productivo.">
          <Num name="days" label="Días programados" values={values} set={set} errors={errors} />
          <Num name="hours" label="Horas por día" values={values} set={set} errors={errors} />
          <Num name="excluded" label="Minutos excluidos" values={values} set={set} errors={errors} hint="Refrigerio, capacitación, limpieza…" />
          <Num name="productive" label="Factor productivo (%)" values={values} set={set} errors={errors} />
        </Group>

        <Group title="Distribución del costo" text="Debe sumar 100 %. La parte que no es MOD se reparte como gasto indirecto, sin duplicar la planilla.">
          <Num name="mod" label="Mano de obra directa (%)" values={values} set={set} errors={errors} />
          <Num name="cif" label="CIF (%)" values={values} set={set} errors={errors} />
          <Num name="admin" label="Administración (%)" values={values} set={set} errors={errors} />
          <Num name="sales" label="Ventas (%)" values={values} set={set} errors={errors} />
          {select("basis", BASIS, "Base para repartir la parte indirecta")}
          <Field label="Justificación de la distribución" name="justification" error={errors.justification}>
            {(p) => <input {...p} name="justification" maxLength={500} value={values.justification} onChange={(ev) => set("justification", ev.target.value)} placeholder="Cocina 100 % en producción" />}
          </Field>
          {select(
            "direct_basis",
            [
              { value: "time", label: "Por minutos dedicados a cada receta" },
              { value: "quantity", label: "Por porciones producidas (esfuerzo comparable)" },
            ],
            "Cómo repartir el trabajo directo",
          )}
          {values.direct_basis === "quantity" && (
            <Num
              name="planned_units"
              label="Porciones mensuales previstas"
              values={values}
              set={set}
              errors={errors}
              hint="Cuántas porciones prepara en el mes; su costo directo se divide entre ellas."
            />
          )}
        </Group>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl bg-[#032a1f] p-5 text-white">
          <p className="text-sm font-semibold text-[#9dc0b0]">Costo de {periodLabel}</p>
          <p className="mt-1 font-brand text-3xl font-extrabold tabular-nums">{r ? formatMoney(r.total, currency) : "—"}</p>
          <dl className="mt-4 space-y-2 text-sm">
            {[
              ["Mano de obra directa", r ? formatMoney(r.cost, currency) : "—"],
              ["Minutos MOD efectivos", r ? formatQty(r.minutes, 2) : "—"],
              [r?.directBasis === "quantity" ? "Costo por porción" : "Tarifa por minuto", r ? (r.directBasis === "quantity" ? (r.unitRate ? formatMoney(r.unitRate, currency, 4) : "—") : r.rate ? formatMoney(r.rate, currency, 4) : "Sin minutos") : "—"],
              ["A CIF", r ? formatMoney(r.indirect.cif, currency) : "—"],
              ["A administración", r ? formatMoney(r.indirect.admin, currency) : "—"],
              ["A ventas", r ? formatMoney(r.indirect.sales, currency) : "—"],
            ].map(([k, val]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-[#9dc0b0]">{k}</dt>
                <dd className="font-bold tabular-nums">{val}</dd>
              </div>
            ))}
          </dl>
          {"errors" in preview && <p className="mt-4 text-xs text-[#d8ee9c]">Completa los datos para ver el cálculo.</p>}
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <SaveButton className="w-full">Guardar costo de {periodLabel}</SaveButton>
          <FormAlert error={state.error} message={state.message} />
        </div>
      </aside>
    </form>
  );
}

/* ───────────── Operaciones de receta ───────────── */

function Remove({ recipeId, position }: { recipeId: number; position: number }) {
  const { pending } = useFormStatus();
  return (
    <>
      <input type="hidden" name="recipeId" value={recipeId} />
      <input type="hidden" name="position" value={position} />
      <button type="submit" disabled={pending} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-[#9b2c2c] hover:bg-[#fdecec] disabled:opacity-60">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
        Quitar
      </button>
    </>
  );
}

export function OperationsEditor({
  recipeId,
  operations,
  employees,
  names,
  flags,
  hasLines,
}: {
  recipeId: number;
  operations: { employee_id: number; activity: string; minutes: string }[];
  employees: { id: number; name: string; role: string }[];
  names: Record<number, string>;
  flags: { noMaterials: boolean; noLabor: boolean };
  hasLines: boolean;
}) {
  const [state, action] = useActionState<PersonalState, FormData>(addOperation, {});
  const [flagState, flagAction] = useActionState<PersonalState, FormData>(setRecipeWork, {});
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  return (
    <div className="space-y-5">
      {operations.length ? (
        <ul className="divide-y divide-[#e2e9e5] rounded-2xl border border-[#e2e9e5]">
          {operations.map((op, i) => (
            <li key={`${op.employee_id}-${op.activity}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-[#032a1f]">{op.activity}</span>
                <span className="block text-sm text-[#5b6b65]">{names[op.employee_id] ?? `Trabajador #${op.employee_id}`}</span>
              </span>
              <span className="text-sm font-bold tabular-nums">{formatQty(op.minutes, 2)} min / lote</span>
              <form action={removeOperation}>
                <Remove recipeId={recipeId} position={i} />
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[#5b6b65]">Sin operaciones. Agrega quién prepara el plato y cuántos minutos le toma el lote completo.</p>
      )}

      <form action={action} className="grid gap-4 rounded-2xl bg-[#f6f9f7] p-4 sm:grid-cols-[1fr_1fr_140px_auto] sm:items-end" noValidate key={state.message}>
        <input type="hidden" name="recipeId" value={recipeId} />
        <Field label="Trabajador" name="employeeId" error={e.employeeId}>
          {(p) => (
            <select {...p} name="employeeId" defaultValue={v.employeeId ?? ""}>
              <option value="">Elige</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} · {emp.role}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Actividad" name="activity" error={e.activity}>
          {(p) => <input {...p} name="activity" maxLength={180} defaultValue={v.activity} placeholder="Preparación del plato" />}
        </Field>
        <Field label="Minutos por lote" name="minutes" error={e.minutes}>
          {(p) => <input {...p} name="minutes" inputMode="decimal" defaultValue={v.minutes} placeholder="10" />}
        </Field>
        <SaveButton className="min-h-12">
          <Plus className="size-4" aria-hidden />
          Agregar
        </SaveButton>
        {state.error && (
          <div className="sm:col-span-4">
            <FormAlert error={state.error} />
          </div>
        )}
      </form>

      <form action={flagAction} className="flex flex-wrap items-center gap-4 text-sm">
        <input type="hidden" name="recipeId" value={recipeId} />
        <label className="flex min-h-11 items-center gap-2 font-semibold text-[#12251f]">
          <input type="checkbox" name="noMaterials" defaultChecked={flags.noMaterials} disabled={hasLines} className="size-5 accent-[#006b4b]" />
          No requiere materiales
        </label>
        <label className="flex min-h-11 items-center gap-2 font-semibold text-[#12251f]">
          <input type="checkbox" name="noLabor" defaultChecked={flags.noLabor} disabled={operations.length > 0} className="size-5 accent-[#006b4b]" />
          No requiere mano de obra directa
        </label>
        <SaveButton className="min-h-10 px-4 text-sm">Guardar</SaveButton>
        <FormAlert error={flagState.error} message={flagState.message} />
      </form>
    </div>
  );
}
