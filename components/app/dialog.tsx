"use client";

import { useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
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
        className={cn(
          "inline-flex min-h-12 items-center gap-2 rounded-xl px-5 text-[15px] font-extrabold transition-colors",
          variant === "primary" ? "bg-[#006b4b] text-white hover:bg-[#00563d]" : "bg-white text-[#006b4b] hover:bg-[#ecf8f2]",
        )}
      >
        {Icon && <Icon className="size-5" aria-hidden />}
        {label}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={id}
        className="m-auto w-[min(640px,calc(100vw-32px))] rounded-[28px] bg-white p-0 text-[#12251f] shadow-float backdrop:bg-[#032a1f]/50"
      >
        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={id} className="font-brand text-2xl font-extrabold text-[#032a1f]">
                {title}
              </h2>
              {text && <p className="mt-1 text-sm text-[#5b6b65]">{text}</p>}
            </div>
            <button type="button" onClick={() => ref.current?.close()} aria-label="Cerrar" className="grid size-11 shrink-0 place-items-center rounded-xl text-[#5b6b65] hover:bg-[#f6f9f7]">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="mt-6">{children}</div>
        </div>
      </dialog>
    </>
  );
}
