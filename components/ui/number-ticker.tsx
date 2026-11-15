"use client"

import { useEffect, useMemo, useRef, type ComponentPropsWithoutRef } from "react"
import { animate, useInView } from "motion/react"

import { cn } from "@/lib/utils"

interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
  value: number
  startValue?: number
  delay?: number
  decimalPlaces?: number
}

/**
 * NumberTicker de Magic UI (MIT), adaptado a costea:
 * - El servidor entrega el valor final (el original entregaba el inicial: sin JS se veía "0").
 * - Cuenta una sola vez al entrar en pantalla; con `prefers-reduced-motion` no cuenta.
 * - Formato es-PE y sin colores propios: hereda el color del texto.
 */
export function NumberTicker({ value, startValue = 0, delay = 0, decimalPlaces = 0, className, ...props }: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })
  const format = useMemo(
    () => new Intl.NumberFormat("es-PE", { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces }),
    [decimalPlaces],
  )

  useEffect(() => {
    const el = ref.current
    if (!el || !isInView) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const controls = animate(startValue, value, {
      duration: 1.2,
      delay,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = format.format(Number(v.toFixed(decimalPlaces)))
      },
    })
    return () => controls.stop()
  }, [isInView, value, startValue, delay, decimalPlaces, format])

  return (
    <span ref={ref} className={cn("inline-block tabular-nums", className)} {...props}>
      {format.format(value)}
    </span>
  )
}
