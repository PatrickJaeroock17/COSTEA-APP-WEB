"use client";

import { useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Botón que abre un diálogo modal nativo (foco atrapado, Escape cierra). `open` lo reabre tras un error. */
export function Dialog({
  label,
  icon: Icon,
  title,
  text,
  open,
  variant = "primary",
  children,
}: {
  label: string;
  icon?: LucideIcon;
  title: string;
  text?: string;
  open?: unknown;
  variant?: "primary" | "ghost";
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) ref.current?.showModal();
  }, [open]);
  const id = `dlg-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className={cn(buttonVariants({ variant: variant === "primary" ? "default" : "outline", size: "lg" }))}
      >
        {Icon && <Icon className="size-5" aria-hidden />}
        {label}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={id}
        className="m-auto w-[min(640px,calc(100vw-32px))] rounded-4xl bg-white p-0 text-ink shadow-float backdrop:bg-brand-900/50"
      >
        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={id} className="font-heading text-2xl font-extrabold text-heading">
                {title}
              </h2>
              {text && <p className="mt-1 text-sm text-muted-foreground">{text}</p>}
            </div>
            <button type="button" onClick={() => ref.current?.close()} aria-label="Cerrar" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-muted-foreground")}>
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="mt-6">{children}</div>
        </div>
      </dialog>
    </>
  );
}
