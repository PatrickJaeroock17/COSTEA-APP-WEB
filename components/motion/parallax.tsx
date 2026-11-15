"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Parallax muy leve, solo para fondos decorativos: el contenido se desplaza ±`distance` px mientras
 * el bloque cruza la pantalla. Siempre `aria-hidden` y sin eventos de puntero. Con `prefers-reduced-motion` queda fijo.
 * El contenedor debe estar posicionado (pasar `absolute …` en `className`).
 */
export function Parallax({ children, className, distance = 36 }: { children: React.ReactNode; className?: string; distance?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-distance, distance]);
  return (
    <div ref={ref} aria-hidden className={cn("pointer-events-none", className)}>
      <motion.div className="size-full" style={reduced ? undefined : { y }}>
        {children}
      </motion.div>
    </div>
  );
}
