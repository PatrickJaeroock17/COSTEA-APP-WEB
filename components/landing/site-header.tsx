"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { container } from "@/components/landing/styles";
import { buttonVariants } from "@/components/ui/button";
import { cn, focusRing } from "@/lib/utils";

const links = [
  { id: "incluye", label: "Qué incluye" },
  { id: "como-funciona", label: "Cómo funciona" },
  { id: "planes", label: "Planes" },
  { id: "preguntas", label: "Preguntas" },
];

const menuItem = cn("flex min-h-11 items-center rounded-xl px-3 text-body hover:bg-brand-50", focusRing);

/**
 * Barra superior fija de la landing (DESIGN.md §13): transparente arriba, translúcida al bajar.
 * Marca la sección que cruza el centro de la pantalla con un punto verde y `aria-current`.
 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
          else setActive((cur) => (cur === e.target.id ? null : cur));
        }
      },
      // Una franja fina en el centro de la pantalla: activa es la sección que la cruza.
      { rootMargin: "-45% 0px -54% 0px" },
    );
    links.forEach((l) => {
      const el = document.getElementById(l.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  // Menú móvil: Escape lo cierra y devuelve el foco al botón; se cierra solo al pasar a escritorio.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    const mq = window.matchMedia("(min-width: 768px)");
    const onWide = () => mq.matches && setOpen(false);
    window.addEventListener("keydown", onKey);
    mq.addEventListener("change", onWide);
    return () => {
      window.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onWide);
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-colors duration-300",
        scrolled || open ? "border-line bg-white/80 backdrop-blur-[14px] backdrop-saturate-150" : "border-transparent",
      )}
    >
      <div className={cn(container, "grid h-nav grid-cols-[1fr_auto] items-center gap-3 md:grid-cols-[1fr_auto_1fr]")}>
        <Logo className="justify-self-start" />

        <nav aria-label="Secciones" className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const on = active === l.id;
            return (
              <a
                key={l.id}
                href={`#${l.id}`}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "relative rounded-full px-3.5 py-2 text-body font-semibold transition-colors hover:bg-brand-900/5 hover:text-heading",
                  on ? "text-heading" : "text-ink-soft",
                  focusRing,
                )}
              >
                {l.label}
                <i
                  aria-hidden
                  className={cn(
                    "absolute bottom-0.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-primary transition-[opacity,scale] duration-300",
                    on ? "scale-100 opacity-100" : "scale-0 opacity-0",
                  )}
                />
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 justify-self-end md:gap-2.5">
          <Link href="/ingresar" className={cn(buttonVariants({ variant: "outline", shape: "pill" }), "h-11 text-sm font-bold")}>
            Iniciar sesión
          </Link>
          <Link href="/registro" className={cn(buttonVariants({ shape: "pill" }), "btn-sheen hidden h-11 px-5 font-bold md:inline-flex")}>
            Crear cuenta
          </Link>
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="menu-movil"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            className={cn("grid size-11 place-items-center rounded-xl text-heading md:hidden", focusRing)}
          >
            {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
          </button>
        </div>
      </div>

      {/* Panel móvil: forma parte de la barra, así hereda su fondo translúcido. */}
      <nav
        id="menu-movil"
        aria-label="Secciones (móvil)"
        hidden={!open}
        className={cn(container, "pb-4 animate-in fade-in slide-in-from-top-1 duration-200 md:hidden")}
      >
        {links.map((l) => (
          <a
            key={l.id}
            href={`#${l.id}`}
            onClick={() => setOpen(false)}
            aria-current={active === l.id ? "true" : undefined}
            className={cn(menuItem, "font-semibold text-ink")}
          >
            {l.label}
          </a>
        ))}
        <Link href="/registro" className={cn(buttonVariants({ shape: "pill", size: "lg" }), "btn-sheen mt-2 w-full")}>
          Crear cuenta
        </Link>
      </nav>
    </header>
  );
}
