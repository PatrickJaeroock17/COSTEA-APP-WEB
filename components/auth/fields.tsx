"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, fieldClass } from "@/components/ui/input";
import { cn, focusRing } from "@/lib/utils";

/** Campo nativo (input, select) con el estilo de `components/ui/input` y el margen bajo su etiqueta. */
export const inputClass = cn(fieldClass, "mt-1.5 h-12");

const labelClass = "text-sm font-bold text-ink";

/** Enlace de texto de los formularios de acceso. */
export const authLink = cn("rounded-sm font-bold text-primary underline-offset-4 hover:underline", focusRing);

export function TextField({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn("block", labelClass)}>
      {label}
      <Input {...props} className="mt-1.5" />
    </label>
  );
}

export function PasswordField({
  label = "Contraseña",
  aside,
  ...props
}: { label?: string; aside?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  const id = props.id ?? "password";
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        {aside}
      </div>
      <div className="relative mt-1.5">
        <Input name="password" {...props} id={id} type={show ? "text" : "password"} className="pr-13" />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={show}
          className={cn("absolute inset-y-0.5 right-0.5 grid w-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-line hover:text-ink", focusRing)}
        >
          {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      </div>
    </div>
  );
}

export function SubmitButton({ children, variant = "primary" }: { children: React.ReactNode; variant?: "primary" | "light" }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      variant={variant === "primary" ? "default" : "outline"}
      className={cn("w-full", variant === "light" && "text-ink hover:bg-surface")}
    >
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

export function FormAlert({ error, message }: { error?: string; message?: string }) {
  if (!error && !message) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={cn("flex items-start gap-2 rounded-xl px-4 py-3 text-sm leading-snug", error ? "bg-danger-soft text-danger-text" : "bg-success-soft text-success-text")}
    >
      {error ? <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />}
      {error ?? message}
    </p>
  );
}

export function Divider() {
  return (
    <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground" aria-hidden>
      <span className="h-px flex-1 bg-line" /> o <span className="h-px flex-1 bg-line" />
    </div>
  );
}
