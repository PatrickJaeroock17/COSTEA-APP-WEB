"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const inputClass =
  "mt-1.5 h-12 w-full rounded-xl border border-transparent bg-[#f2f5f3] px-4 text-[15px] text-[#12251f] placeholder:text-[#8a9a93] outline-none transition-colors focus:border-[#006b4b] focus:bg-white focus:ring-4 focus:ring-[#006b4b]/12";

export function TextField({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-sm font-bold text-[#12251f]">
      {label}
      <input {...props} className={inputClass} />
    </label>
  );
}

export function PasswordField({
  label = "Contraseña",
  aside,
  ...props
}: { label?: string; aside?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={props.id ?? "password"} className="text-sm font-bold text-[#12251f]">{label}</label>
        {aside}
      </div>
      <div className="relative">
        <input id="password" name="password" {...props} type={show ? "text" : "password"} className={`${inputClass} pr-12`} />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute right-1.5 top-[9px] grid size-10 place-items-center rounded-lg text-[#5b6b65] hover:bg-white"
        >
          {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      </div>
    </div>
  );
}

export function SubmitButton({ children, variant = "dark" }: { children: React.ReactNode; variant?: "dark" | "light" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-extrabold transition-colors active:scale-[0.99] disabled:cursor-wait disabled:opacity-70",
        variant === "dark"
          ? "bg-[#032a1f] text-white hover:bg-[#006b4b]"
          : "border border-[#dfe6e2] bg-white text-[#12251f] hover:bg-[#f6f9f7]",
      )}
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function FormAlert({ error, message }: { error?: string; message?: string }) {
  if (!error && !message) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-xl px-4 py-3 text-sm leading-snug",
        error ? "bg-[#fdecec] text-[#9b2c2c]" : "bg-[#e7f6ee] text-[#00563d]",
      )}
    >
      {error ? <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />}
      {error ?? message}
    </p>
  );
}

export function Divider() {
  return (
    <div className="flex items-center gap-3 text-xs font-semibold text-[#8a9a93]" aria-hidden>
      <span className="h-px flex-1 bg-[#e2e9e5]" /> o <span className="h-px flex-1 bg-[#e2e9e5]" />
    </div>
  );
}