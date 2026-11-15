"use client";

import { useEffect, useRef } from "react";
import { animate, inView, stagger } from "motion/react";

/** Curva y distancia comunes a todas las entradas de la landing (DESIGN.md §13). */
export const EASE = [0.22, 1, 0.36, 1] as const;
const OFFSET = 18; // px
const DURATION = 0.6; // s
const MARGIN = "0px 0px -10% 0px";

/**
 * Entrada al hacer scroll, una sola vez: opacidad + translateY.
 * El HTML del servidor sale visible; solo se oculta (ya con JS) lo que está por debajo de la pantalla,
 * así que con JS lento o sin JS el contenido se ve igual y no hay saltos de layout.
 * Con `prefers-reduced-motion` no se hace nada.
 */
function useEnter(each: boolean, delay: number) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return; // ya está a la vista

    const targets = each ? (Array.from(el.children) as HTMLElement[]) : [el];
    if (!targets.length) return;
    const clear = () =>
      targets.forEach((t) => {
        t.style.opacity = "";
        t.style.transform = "";
      });
    targets.forEach((t) => {
      t.style.opacity = "0";
      t.style.transform = `translateY(${OFFSET}px)`;
    });

    let controls: ReturnType<typeof animate> | undefined;
    const stop = inView(
      el,
      () => {
        controls = animate(
          targets,
          { opacity: [0, 1], transform: [`translateY(${OFFSET}px)`, "translateY(0px)"] },
          { duration: DURATION, ease: EASE, delay: each ? stagger(0.07, { startDelay: delay }) : delay },
        );
        controls.then(clear);
      },
      { margin: MARGIN },
    );

    return () => {
      stop();
      controls?.stop();
      clear();
    };
  }, [each, delay]);

  return ref;
}

/** Un bloque que aparece al entrar en pantalla. `delay` en segundos. */
export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useEnter(false, delay);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** Contenedor cuyos hijos directos aparecen en cascada corta. Sirve como rejilla: recibe las clases del layout. */
export function Stagger({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useEnter(true, delay);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
