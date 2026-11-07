"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Selector desplegable (restaurante, mes). Se cierra con clic fuera o Escape. */
export function SelectMenu({
  icon: Icon,
  options,
  value,
  onChange,
  label,
  short,
  className,
}: {
  icon: LucideIcon;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  label: string;
  /** Texto corto para pantallas pequeñas. */
  short?: (v: string) => string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-[#e2e9e5] bg-white px-3.5 text-sm font-semibold text-[#12251f] transition-colors hover:border-[#006b4b]/40 sm:text-[15px]"
      >
        <Icon className="size-[18px] shrink-0 text-[#5b6b65]" aria-hidden />
        {short ? (<><span className="truncate sm:hidden">{short(value)}</span><span className="hidden truncate sm:inline">{value}</span></>) : <span className="truncate">{value}</span>}
        <ChevronDown className={cn("ml-auto size-4 shrink-0 text-[#5b6b65] transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 top-full z-30 mt-2 max-h-72 min-w-full overflow-auto rounded-2xl border border-[#e2e9e5] bg-white p-1.5 shadow-[0_18px_40px_rgba(3,42,31,0.14)] animate-in fade-in zoom-in-95 duration-150"
        >
          {options.map((o) => (
            <li key={o} role="option" aria-selected={o === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
                className={cn(
                  "flex min-h-10 w-full items-center justify-between gap-6 whitespace-nowrap rounded-xl px-3 text-left text-sm font-semibold transition-colors",
                  o === value ? "bg-[#ecf8f2] text-[#006b4b]" : "text-[#12251f] hover:bg-[#f6f9f7]",
                )}
              >
                {o}
                {o === value && <Check className="size-4" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

