"use client";

import { useActionState } from "react";
import { Store } from "lucide-react";
import { FormAlert, SubmitButton, TextField } from "@/components/auth/fields";
import { createRestaurant, type FormState } from "@/lib/actions/auth";

/** Primer paso para quien entró sin restaurante (por ejemplo, con Google). */
export function CreateRestaurant({ name }: { name: string }) {
  const [state, action] = useActionState<FormState, FormData>(createRestaurant, {});
  return (
    <div className="mx-auto max-w-xl rounded-[28px] border border-[#e2e9e5] bg-white p-7 sm:p-10">
      <span className="grid size-12 place-items-center rounded-2xl bg-[#006b4b] text-[#a9d63a]">
        <Store className="size-6" aria-hidden />
      </span>
      <h1 className="mt-5 font-brand text-3xl font-extrabold tracking-[-0.02em] text-[#032a1f]">¡Hola, {name}!</h1>
      <p className="mt-2 text-[#5b6b65]">Para empezar, crea tu restaurante. Podrás cambiar sus datos después en Configuración.</p>
      <form action={action} className="mt-6 space-y-4">
        <TextField label="Nombre de tu restaurante" name="restaurant" required maxLength={180} placeholder="Mi restaurante" defaultValue={state.values?.restaurant} />
        <FormAlert error={state.error} />
        <SubmitButton>Crear restaurante</SubmitButton>
      </form>
    </div>
  );
}