import Link from "next/link"

import { cn } from "@/lib/utils"

/**
 * ShimmerButton de Magic UI (MIT), adaptado a costea como enlace: es el CTA "Crear mi cuenta" de la landing.
 * Misma forma que el CTA de DESIGN.md §6 (píldora de 56 px con círculo y flecha) más un destello que recorre el borde.
 * - `tone="green"`: píldora verde sobre fondos claros. `tone="lime"`: píldora lima sobre brand-900.
 * - Colores con tokens. El destello no se monta con `prefers-reduced-motion` y se pausa fuera de pantalla (`data-inview`).
 * El círculo con flecha (`CtaArrow`) se pasa como hijo.
 */
export function ShimmerLink({
  href,
  tone = "green",
  className,
  children,
}: {
  href: string
  tone?: "green" | "lime"
  className?: string
  children: React.ReactNode
}) {
  const green = tone === "green"
  return (
    <Link
      href={href}
      style={
        {
          "--spread": "90deg",
          "--speed": "3s",
          "--shimmer-color": green ? "var(--color-lime-300)" : "var(--color-white)",
        } as React.CSSProperties
      }
      className={cn(
        "group/shimmer relative z-0 inline-flex min-h-14 items-center justify-between gap-6 overflow-hidden rounded-full pl-6 pr-2 text-base font-extrabold whitespace-nowrap outline-none",
        "transition-transform duration-300 ease-out active:translate-y-px motion-safe:hover:-translate-y-px",
        green
          ? "bg-brand-700 text-white focus-visible:ring-4 focus-visible:ring-ring/30"
          : "bg-lime-600 text-brand-900 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-900",
        className,
      )}
    >
      {/* Destello: un cono de luz que gira detrás del relleno y solo asoma por el filo */}
      <span aria-hidden className="absolute inset-0 -z-30 overflow-visible blur-[2px] @container-[size] motion-reduce:hidden">
        <span className="absolute inset-0 aspect-square h-[100cqh] animate-shimmer-slide">
          <span className="absolute -inset-full w-auto animate-spin-around [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))]" />
        </span>
      </span>
      {children}
      {/* Brillo interior */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full shadow-[inset_0_-8px_10px_rgb(255_255_255/0.12)] transition-shadow duration-300 group-hover/shimmer:shadow-[inset_0_-6px_10px_rgb(255_255_255/0.26)]"
      />
      {/* Relleno: deja 1,5 px de filo para el destello */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-[1.5px] -z-20 rounded-full transition-colors duration-200",
          green ? "bg-primary group-hover/shimmer:bg-brand-700" : "bg-lime-500 group-hover/shimmer:bg-lime-400",
        )}
      />
    </Link>
  )
}
