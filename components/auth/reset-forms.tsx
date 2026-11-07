"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormAlert, PasswordField, SubmitButton, TextField } from "@/components/auth/fields";
import { requestPasswordReset, updatePassword, type FormState } from "@/lib/actions/auth";

export function RequestResetForm() {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, {});
  return (
    <form action={action} className="space-y-4">
      <TextField label="Correo electrónico" name="email" type="email" required autoComplete="email" placeholder="nombre@correo.com" defaultValue={state.values?.email} key={state.values?.email} />
      <FormAlert error={state.error} message={state.message} />
      <SubmitButton>Enviar enlace</SubmitButton>
      <p className="text-center text-sm text-[#5b6b65]">
        <Link href="/ingresar" className="font-extrabold text-[#032a1f] hover:text-[#006b4b] hover:underline">Volver a iniciar sesión</Link>
      </p>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(updatePassword, {});
  return (
    <form action={action} className="space-y-4">
      <PasswordField label="Nueva contraseña" required minLength={8} autoComplete="new-password" placeholder="Mínimo 8 caracteres" />
      <FormAlert error={state.error} />
      <SubmitButton>Guardar y entrar</SubmitButton>
    </form>
  );
}