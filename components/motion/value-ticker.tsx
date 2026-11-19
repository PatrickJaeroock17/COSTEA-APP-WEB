"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "motion/react";

/** Textos ya animados en esta sesión: el contador corre solo en la primera carga de cada cifra. */
const played = new Set<string>();

const NUMBER = /\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?/;
const group = (int: string) => int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/**
 * Cuenta de 0 al valor de una cifra ya formateada («S/ 12,000», «30 %», «S/ 10.00»), conservando prefijo, sufijo,
 * decimales y separador de miles. El servidor entrega el texto final (sin JS no hay «0»); el contador corre una vez al
 * entrar en pantalla y termina escribiendo el texto exacto. Con `prefers-reduced-motion` o si el texto no se puede
 * leer con seguridad, se muestra tal cual. Solo muestra: los cálculos siguen en `lib/costing`.
 */
export function ValueTicker({ text, id, className }: { text: string; id: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [frame, setFrame] = useState<string | null>(null);

  useEffect(() => {
    if (!inView || played.has(id)) return;
    played.add(id);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const m = NUMBER.exec(text);
    if (!m) return;
    const raw = m[0];
    const decimals = raw.includes(".") ? raw.length - raw.indexOf(".") - 1 : 0;
    const grouped = raw.includes(",");
    const target = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(target) || target === 0) return;
    const before = text.slice(0, m.index);
    const after = text.slice(m.index + raw.length);
    const controls = animate(0, target, {
      duration: 1,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        const [i, f] = v.toFixed(decimals).split(".");
        setFrame(`${before}${grouped ? group(i) : i}${f ? `.${f}` : ""}${after}`);
      },
      onComplete: () => setFrame(null),
    });
    return () => {
      controls.stop();
      setFrame(null);
    };
  }, [inView, id, text]);

  return (
    <span ref={ref} className={className}>
      {frame ?? text}
    </span>
  );
}
