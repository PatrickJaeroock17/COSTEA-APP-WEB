import { type ComponentPropsWithoutRef } from "react"

import { cn } from "@/lib/utils"

interface MarqueeProps extends ComponentPropsWithoutRef<"div"> {
  /** Invierte el sentido. */
  reverse?: boolean
  /** Pausa al pasar el cursor. */
  pauseOnHover?: boolean
  children: React.ReactNode
  /** Veces que se repite el contenido para llenar el ancho. */
  repeat?: number
}

/**
 * Marquee de Magic UI (MIT), adaptado a costea: solo horizontal, las copias van con `aria-hidden`
 * (el lector de pantalla lee la lista una vez) y con `prefers-reduced-motion` se queda quieto.
 */
export function Marquee({ className, reverse = false, pauseOnHover = false, children, repeat = 4, ...props }: MarqueeProps) {
  return (
    <div {...props} className={cn("group flex flex-row gap-(--gap) overflow-hidden [--duration:40s] [--gap:1rem]", className)}>
      {Array.from({ length: repeat }, (_, i) => (
        <div
          key={i}
          aria-hidden={i > 0 || undefined}
          className={cn(
            "flex shrink-0 animate-marquee flex-row justify-around gap-(--gap) motion-reduce:animate-none",
            pauseOnHover && "group-hover:[animation-play-state:paused]",
            reverse && "[animation-direction:reverse]",
          )}
        >
          {children}
        </div>
      ))}
    </div>
  )
}
