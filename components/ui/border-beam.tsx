import { cn } from "@/lib/utils"

interface BorderBeamProps {
  /** Largo del haz, en px. */
  size?: number
  /** Segundos por vuelta. */
  duration?: number
  /** Desfase inicial, en segundos. */
  delay?: number
  /** Grosor del borde, en px. */
  borderWidth?: number
  /** Clases del haz (p. ej. otro degradado con tokens). */
  className?: string
}

/**
 * BorderBeam de Magic UI (MIT), adaptado a costea: un haz de luz que recorre el borde del contenedor
 * (que debe ser `relative` y tener su propio radio).
 * - Colores con tokens (lima → verde), sin hex.
 * - Animación en CSS (`animate-border-beam`) en vez de motion: así se pausa fuera de pantalla con
 *   `data-inview` y no se monta con `prefers-reduced-motion`.
 */
export function BorderBeam({ size = 140, duration = 9, delay = 0, borderWidth = 1, className }: BorderBeamProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[inherit] border-(length:--border-beam-width) border-transparent mask-[linear-gradient(transparent,transparent),linear-gradient(black,black)] mask-intersect [mask-clip:padding-box,border-box] motion-reduce:hidden"
      style={{ "--border-beam-width": `${borderWidth}px` } as React.CSSProperties}
    >
      <div
        className={cn("absolute aspect-square animate-border-beam bg-linear-to-l from-lime-400 via-brand-300 to-transparent", className)}
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            "--duration": `${duration}s`,
            animationDelay: `-${delay}s`,
          } as React.CSSProperties
        }
      />
    </div>
  )
}
