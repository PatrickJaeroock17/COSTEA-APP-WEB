"use client";

import Link from "next/link";
import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { Divider, FormAlert, PasswordField, SubmitButton, TextField, authLink } from "@/components/auth/fields";
import { GoogleButton } from "@/components/auth/google-button";
import { signUp, type FormState } from "@/lib/actions/auth";

export function RegisterForm() {
  const [state, action] = useActionState<FormState, FormData>(signUp, {});

  if (state.message) {
    return (
      <div className="space-y-5 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-success-soft text-success">
          <MailCheck className="size-7" aria-hidden />
        </span>
        <p className="text-body leading-relaxed text-ink-soft" role="status">{state.message}</p>
        <p className="text-sm text-muted-foreground">¿No llegó? Revisa la carpeta de spam o espera un minuto.</p>
        <Link href="/ingresar" className={authLink}>Ir a iniciar sesión</Link>
      </div>
    );
  }

  const v = state.values ?? {};
  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4">
        <TextField label="Tu nombre" name="name" required maxLength={100} autoComplete="name" placeholder="Patrick" defaultValue={v.name} key={`n${v.name}`} />
        <TextField label="Nombre de tu restaurante" name="restaurant" required maxLength={180} autoComplete="organization" placeholder="Mi restaurante" defaultValue={v.restaurant} key={`r${v.restaurant}`} />
        <TextField label="Correo electrónico" name="email" type="email" required autoComplete="email" placeholder="nombre@correo.com" defaultValue={v.email} key={`e${v.email}`} />
        <PasswordField required minLength={8} autoComplete="new-password" placeholder="Mínimo 8 caracteres" />
        <FormAlert error={state.error} />
        <SubmitButton>Crear cuenta</SubmitButton>
      </form>
      <Divider />
      <GoogleButton />
      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/ingresar" className={authLink}>Inicia sesión</Link>
      </p>
    </div>
  );
}