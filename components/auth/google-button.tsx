"use client";

import Image from "next/image";
import { useActionState } from "react";
import { FormAlert, SubmitButton } from "@/components/auth/fields";
import { signInWithGoogle, type FormState } from "@/lib/actions/auth";

/** Logo de Google con sus colores oficiales (archivo aparte: no son colores de costea). */
function GoogleMark() {
  return <Image src="/brand/google.svg" alt="" width={20} height={20} className="size-5" />;
}

export function GoogleButton({ next }: { next?: string }) {
  const [state, action] = useActionState<FormState, FormData>(signInWithGoogle, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next ?? ""} />
      <SubmitButton variant="light">
        <GoogleMark /> Continuar con Google
      </SubmitButton>
      <FormAlert error={state.error} />
    </form>
  );
}