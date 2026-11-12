"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { inputClass } from "@/components/auth/fields";
import { cn } from "@/lib/utils";

export { FormAlert } from "@/components/auth/fields";

/** Campo con etiqueta, ayuda y error accesibles. */
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
      <label htmlFor={id} className="block text-sm font-bold text-[#12251f]">
        {label}
      </label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        className: cn(inputClass, error && "border-[#c53030] bg-white focus:border-[#c53030] focus:ring-[#c53030]/12"),
      })}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-[#5b6b65]">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-semibold text-[#9b2c2c]">
          {error}
        </p>
      )}
    </div>
  );
}

export function SaveButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#006b4b] px-6 text-[15px] font-extrabold text-white transition-colors hover:bg-[#00563d] disabled:cursor-wait disabled:opacity-70",
        className,
      )}
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export const card = "rounded-[24px] border border-[#e2e9e5] bg-white";
