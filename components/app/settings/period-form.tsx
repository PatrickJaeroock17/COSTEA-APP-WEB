"use client";

import { useActionState } from "react";
import { Field, FormAlert, SaveButton } from "@/components/app/form";
import { createPeriod, type WorkspaceState } from "@/lib/actions/workspace";

export function PeriodForm({ defaultMonth }: { defaultMonth: string }) {
  const [state, action] = useActionState<WorkspaceState, FormData>(createPeriod, {});
  return (
    <form action={action} className="flex flex-col gap-4 sm:flex-row sm:items-end" noValidate>
      <Field label="Mes y año" name="month" error={state.fieldErrors?.month} className="sm:w-64">
        {(p) => <input {...p} type="month" name="month" required defaultValue={state.values?.month || defaultMonth} />}
      </Field>
      <SaveButton>Agregar mes</SaveButton>
      {!state.fieldErrors?.month && <FormAlert error={state.error} message={state.message} />}
    </form>
  );
}
