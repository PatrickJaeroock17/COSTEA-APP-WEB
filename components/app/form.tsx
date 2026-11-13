"use client";

import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Campo con etiqueta, ayuda y error accesibles (DESIGN.md §9). Sirve para input, select y textarea nativos. */
export function Field({
  label,
  name,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: (props: { id: string; "aria-invalid"?: true; "aria-describedby"?: string; className: string }) => React.ReactNode;
  className?: string;
}) {
  const id = `f-${name}`;
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-bold text-ink">
        {label}
      </label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        className: cn(fieldClass, "mt-1.5 h-12"),
      })}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-semibold text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}

/** Botón de envío con estado de carga (variante primaria de `Button`). */
export function SaveButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn(buttonVariants({ size: "lg" }), "disabled:cursor-wait", className)}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/** Alerta del formulario: error o confirmación (tabla de estados de DESIGN.md). */
export function FormAlert({ error, message }: { error?: string; message?: string }) {
  if (!error && !message) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-xl px-4 py-3 text-sm leading-snug",
        error ? "bg-danger-soft text-danger-text" : "bg-success-soft text-success-text",
      )}
    >
      {error ? <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />}
      {error ?? message}
    </p>
  );
}

/** Tarjeta de la app (DESIGN.md §7). Preferir `Card` de `components/ui/card` en código nuevo. */
export const card = "rounded-3xl border border-line bg-card";
