"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";

/**
 * Selector desplegable (restaurante, mes). Se cierra con clic fuera o Escape.
 * Teclado: ↓/↑ abren y recorren las opciones, Inicio/Fin van a los extremos y Escape devuelve el foco al botón.
 */
export function SelectMenu({
  icon: Icon,
  options,
  value,
  onChange,
  label,
  short,
  footer,
  className,
}: {
  icon: LucideIcon;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  label: string;
  /** Texto corto para pantallas pequeñas. */
  short?: (v: string) => string;
  /** Acción al pie de la lista (por ejemplo, «Agregar mes»). Recibe la función para cerrar. */
  footer?: (close: () => void) => React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? value;
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  /** Opciones y acción del pie, en orden: lo que se recorre con las flechas. */
  const items = () => Array.from(listRef.current?.querySelectorAll<HTMLElement>("button, a[href]") ?? []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    // Al abrir, el foco va a la opción elegida (o a la primera).
    (listRef.current?.querySelector<HTMLElement>('[aria-selected="true"] button') ?? items()[0])?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onListKey = (e: React.KeyboardEvent) => {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLElement);
    const to = e.key === "ArrowDown" ? at + 1 : e.key === "ArrowUp" ? at - 1 : e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    list[(to + list.length) % list.length]?.focus();
  };

  return (
    <div ref={ref} className={cn("relative sm:max-w-72", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        title={current}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-line bg-card px-3.5 text-sm font-semibold text-ink transition-colors outline-none hover:border-primary/40 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/15 sm:text-body"
      >
        <Icon className="size-4.5 shrink-0 text-muted-foreground" aria-hidden />
        {short ? (
          <>
            <span className="truncate sm:hidden">{short(current)}</span>
            <span className="hidden truncate sm:inline">{current}</span>
          </>
        ) : (
          <span className="truncate">{current}</span>
        )}
        <ChevronDown className={cn("ml-auto size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          onKeyDown={onListKey}
          className="absolute left-0 top-full z-30 mt-2 max-h-72 min-w-full overflow-auto rounded-2xl border border-line bg-popover p-1.5 shadow-lift animate-in fade-in zoom-in-95 duration-150"
        >
          {options.map((o) => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className={cn(
                  "flex min-h-10 w-full items-center justify-between gap-6 whitespace-nowrap rounded-xl px-3 text-left text-sm font-semibold transition-colors",
                  focusRing,
                  o.value === value ? "bg-accent text-accent-foreground" : "text-ink hover:bg-surface",
                )}
              >
                {o.label}
                {o.value === value && <Check className="size-4" aria-hidden />}
              </button>
            </li>
          ))}
          {footer && <li className="mt-1 border-t border-line pt-1">{footer(() => setOpen(false))}</li>}
        </ul>
      )}
    </div>
  );
}
