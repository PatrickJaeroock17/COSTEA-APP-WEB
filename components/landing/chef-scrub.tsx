"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// Cuadros extraídos del video de Kling (interpolados a 48 fps) en public/chef/f001.webp … f191.webp
const FRAMES = 191;
const REST = Math.round((FRAMES - 1) * 0.52); // de frente (≈2,1 s del video original)
const LERP = 0.24; // por cuadro a 60 fps; se ajusta por tiempo
const CONCURRENCY = 6;

const src = (i: number) => `/chef/f${String(i + 1).padStart(3, "0")}.webp`;

/** Orden de carga: reposo y primer cuadro, luego los más cercanos al reposo hacia afuera. */
const loadOrder = [REST, 0, FRAMES - 1, ...Array.from({ length: FRAMES }, (_, i) => i)
  .filter((i) => i !== REST && i !== 0 && i !== FRAMES - 1)
  .sort((a, b) => Math.abs(a - REST) - Math.abs(b - REST))];

/**
 * El chef es una secuencia de cuadros dibujados en un <canvas>. El índice de cuadro
 * sigue la posición horizontal del cursor (o del dedo) con suavizado por tiempo.
 */
export function ChefScrub({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!wrap || !canvas || !ctx) return;

    // Con movimiento reducido se queda el cuadro de frente (el <img> de abajo): no hace falta nada más.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const bitmaps: (ImageBitmap | undefined)[] = new Array(FRAMES);
    const ac = new AbortController();
    let target = REST;
    let current = REST;
    let drawn = -1;
    let raf = 0;
    let last = 0;
    let alive = true;

    /** Cuadro cargado más cercano al índice pedido. */
    const nearest = (i: number) => {
      for (let d = 0; d < FRAMES; d++) {
        if (bitmaps[i - d]) return i - d;
        if (bitmaps[i + d]) return i + d;
      }
      return -1;
    };

    const draw = (i: number) => {
      const j = nearest(i);
      if (j < 0 || j === drawn) return;
      const bmp = bitmaps[j]!;
      if (canvas.width !== bmp.width) {
        canvas.width = bmp.width;
        canvas.height = bmp.height;
      }
      ctx.drawImage(bmp, 0, 0);
      drawn = j;
    };

    const tick = (now: number) => {
      raf = 0;
      const dt = last ? Math.min((now - last) / 16.667, 4) : 1;
      last = now;
      current += (target - current) * (1 - Math.pow(1 - LERP, dt));
      if (Math.abs(target - current) < 0.02) current = target;
      draw(Math.round(current));
      if (current !== target) raf = requestAnimationFrame(tick);
      else last = 0;
    };
    const kick = () => {
      if (!raf && alive) raf = requestAnimationFrame(tick);
    };

    // Carga progresiva con pocas descargas en paralelo.
    let next = 0;
    const worker = async () => {
      while (alive && next < loadOrder.length) {
        const i = loadOrder[next++];
        try {
          const res = await fetch(src(i), { signal: ac.signal });
          const bmp = await createImageBitmap(await res.blob());
          if (!alive) return bmp.close();
          bitmaps[i] = bmp;
          // Si el recién llegado es lo que se está mostrando (o más cerca), repintar.
          if (Math.abs(i - current) < Math.abs(drawn - current) || drawn < 0) {
            drawn = -1;
            kick();
          }
        } catch {
          if (!alive) return;
        }
      }
    };
    for (let k = 0; k < CONCURRENCY; k++) void worker();

    const aim = (clientX: number) => {
      const r = wrap.getBoundingClientRect();
      const reach = Math.max(r.width * 0.5, 1);
      const s = Math.max(-1, Math.min(1, (clientX - (r.left + r.width / 2)) / reach));
      target = s < 0 ? REST + s * REST : REST + s * (FRAMES - 1 - REST);
      kick();
    };
    const onMove = (e: PointerEvent) => aim(e.clientX);
    const onTouch = (e: TouchEvent) => {
      if (e.touches[0]) aim(e.touches[0].clientX);
    };
    const onLeave = () => {
      target = REST;
      kick();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      alive = false;
      ac.abort();
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("touchmove", onTouch);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      bitmaps.forEach((b) => b?.close());
    };
  }, []);

  const media =
    "absolute inset-0 h-full w-full object-cover object-[60%_center] [mask-image:linear-gradient(to_right,transparent_0%,black_30%)]";

  return (
    <div ref={wrapRef} className={cn("relative overflow-hidden", className)}>
      {/* Cuadro de frente: se ve al instante, mientras cargan los demás y con movimiento reducido */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src(REST)} alt="Chef de costea" className={media} fetchPriority="high" />
      <canvas ref={canvasRef} aria-hidden className={media} />
    </div>
  );
}
