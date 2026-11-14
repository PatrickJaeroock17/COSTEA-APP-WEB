"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormAlert, PasswordField, SubmitButton, TextField, authLink } from "@/components/auth/fields";
import { requestPasswordReset, updatePassword, type FormState } from "@/lib/actions/auth";

function BackToLogin() {
  return (
    <p className="text-center text-sm text-muted-foreground">
      <Link href="/ingresar" className={authLink}>
        Volver a iniciar sesión
      </Link>
    </p>
  );
}

export function RequestResetForm() {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, {});
  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4">
        <TextField label="Correo electrónico" name="email" type="email" required autoComplete="email" placeholder="nombre@correo.com" defaultValue={state.values?.email} key={state.values?.email} />
        <FormAlert error={state.error} message={state.message} />
        <SubmitButton>Enviar enlace</SubmitButton>
      </form>
      <BackToLogin />
    </div>
  );
}

export function NewPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(updatePassword, {});
  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4">
        <PasswordField label="Nueva contraseña" required minLength={8} autoComplete="new-password" placeholder="Mínimo 8 caracteres" />
        <FormAlert error={state.error} />
        <SubmitButton>Guardar y entrar</SubmitButton>
      </form>
      <BackToLogin />
    </div>
  );
}
