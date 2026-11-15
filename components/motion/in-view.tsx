"use client";

import { useEffect, useRef } from "react";

/**
 * Marca `data-inview="true|false"` según el bloque esté en pantalla. En `app/globals.css`,
 * `[data-inview="false"]` pausa todas las animaciones CSS de dentro: nada gira ni se desliza fuera de pantalla.
 * Sin JS no hay atributo y las animaciones corren normalmente.
 */
export function InView({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => (el.dataset.inview = String(e.isIntersecting)), { rootMargin: "80px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} id={id} className={className}>
      {children}
    </div>
  );
}
