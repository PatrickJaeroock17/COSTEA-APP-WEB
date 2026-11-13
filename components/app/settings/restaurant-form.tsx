"use client";

import { useActionState, useState } from "react";
import { Lock } from "lucide-react";
import { Field, FormAlert, SaveButton } from "@/components/app/form";
import { createRestaurant, updateRestaurant, type WorkspaceState } from "@/lib/actions/workspace";
import { CURRENCIES, IGV_HELP, IGV_OPTIONS, MAX_IGV_PERCENT, TAX_ID_KINDS, igvChoice } from "@/lib/restaurants";

export type RestaurantFormValues = {
  legalName: string;
  tradeName: string;
  taxIdKind: string;
  taxId: string;
  currency: string;
  /** Tasa de IGV guardada (fracción). */
  igvRate?: string;
};

/** Datos del restaurante. `mode="create"` además pide el primer mes de trabajo. */
export function RestaurantForm({
  mode,
  initial,
  currencyLocked = false,
  readOnly = false,
  defaultMonth,
}: {
  mode: "create" | "edit";
  initial?: RestaurantFormValues;
  currencyLocked?: boolean;
  readOnly?: boolean;
  defaultMonth?: string;
}) {
  const [state, action] = useActionState<WorkspaceState, FormData>(mode === "create" ? createRestaurant : updateRestaurant, {});
  const v = { ...initial, ...state.values } as Partial<RestaurantFormValues & { month: string }>;
  const e = state.fieldErrors ?? {};
  const [kind, setKind] = useState(v.taxIdKind || "peru_ruc");
  const saved = igvChoice(initial?.igvRate ?? "");
  const sv = state.values as Record<string, string> | undefined;
  const [igv, setIgv] = useState(sv?.igvChoice || saved.choice);

  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2" noValidate>
      {mode === "create" && <input type="hidden" name="next" value="configuracion" />}
      <fieldset disabled={readOnly} className="contents">
        <Field label="Razón social" name="legalName" error={e.legalName} className="sm:col-span-2">
          {(p) => <input {...p} name="legalName" required minLength={2} maxLength={180} defaultValue={v.legalName} placeholder="Cevichería El Puerto S.A.C." />}
        </Field>
        <Field label="Nombre comercial (opcional)" name="tradeName" error={e.tradeName} hint="Es el que verás en el menú y los reportes." className="sm:col-span-2">
          {(p) => <input {...p} name="tradeName" maxLength={180} defaultValue={v.tradeName} placeholder="El Puerto" />}
        </Field>
        <Field label="Tipo de identificación" name="taxIdKind" error={e.taxIdKind}>
          {(p) => (
            <select {...p} name="taxIdKind" value={kind} onChange={(ev) => setKind(ev.target.value)}>
              {TAX_ID_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={kind === "peru_ruc" ? "RUC (opcional)" : "Identificador (opcional)"} name="taxId" error={e.taxId}>
          {(p) => (
            <input
              {...p}
              name="taxId"
              maxLength={kind === "peru_ruc" ? 11 : 20}
              inputMode={kind === "peru_ruc" ? "numeric" : "text"}
              defaultValue={v.taxId}
              placeholder={kind === "peru_ruc" ? "20123456789" : ""}
            />
          )}
        </Field>
        <Field
          label="Moneda de trabajo"
          name="currency"
          error={e.currency}
          hint={currencyLocked ? "Bloqueada: el restaurante ya tiene importes registrados." : undefined}
        >
          {(p) => (
            <div className="relative">
              <select {...p} name="currency" defaultValue={v.currency || "PEN"} disabled={currencyLocked || readOnly}>
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              {currencyLocked && (
                <>
                  <input type="hidden" name="currency" value={v.currency} />
                  <Lock className="pointer-events-none absolute right-10 top-[22px] size-4 text-[#5b6b65]" aria-hidden />
                </>
              )}
            </div>
          )}
        </Field>
        {mode === "create" ? (
          <Field label="Primer mes de trabajo" name="month" error={e.month}>
            {(p) => <input {...p} type="month" name="month" required defaultValue={v.month || defaultMonth} />}
          </Field>
        ) : (
          <>
            <Field label="IGV de tus precios" name="igvChoice" error={e.igvChoice} hint={igv === "other" ? undefined : IGV_HELP}>
              {(p) => (
                <select {...p} name="igvChoice" value={igv} onChange={(ev) => setIgv(ev.target.value)}>
                  {IGV_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                  <option value="other">Otra tasa</option>
                </select>
              )}
            </Field>
            {igv === "other" && (
              <Field label={`Otra tasa (%, de 0 a ${MAX_IGV_PERCENT})`} name="igvOther" error={e.igvOther} hint={IGV_HELP}>
                {(p) => <input {...p} name="igvOther" inputMode="decimal" defaultValue={sv?.igvOther ?? saved.other} placeholder="12" />}
              </Field>
            )}
          </>
        )}
      </fieldset>
      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
        {!readOnly && <SaveButton>{mode === "create" ? "Crear restaurante" : "Guardar cambios"}</SaveButton>}
        <FormAlert error={state.error} message={state.message} />
      </div>
    </form>
  );
}
