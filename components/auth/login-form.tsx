"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Divider, FormAlert, PasswordField, SubmitButton, TextField } from "@/components/auth/fields";
import { GoogleButton } from "@/components/auth/google-button";
import { signIn, type FormState } from "@/lib/actions/auth";

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  const linkError = params.get("error") === "enlace" ? "El enlace no es válido o ya venció. Inicia sesión o pide uno nuevo." : undefined;
  const [state, action] = useActionState<FormState, FormData>(signIn, {});

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <TextField label="Correo electrónico" name="email" type="email" required autoComplete="email" placeholder="nombre@correo.com" defaultValue={state.values?.email} key={state.values?.email} />
        <PasswordField
          required
          autoComplete="current-password"
          placeholder="Tu contraseña"
          aside={<Link href="/recuperar" className="text-sm font-bold text-[#006b4b] hover:underline">¿Olvidaste tu contraseña?</Link>}
        />
        <FormAlert error={state.error ?? linkError} />
        <SubmitButton>Iniciar sesión</SubmitButton>
      </form>
      <Divider />
      <GoogleButton next={next} />
      <p className="text-center text-sm text-[#5b6b65]">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="font-extrabold text-[#032a1f] hover:text-[#006b4b] hover:underline">Regístrate</Link>
      </p>
    </div>
  );
}