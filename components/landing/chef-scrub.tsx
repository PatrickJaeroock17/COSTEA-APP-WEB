"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// Los 97 cuadros originales del video de Kling (1440×812, WebP calidad 85) en public/chef/f001.webp … f097.webp
const FRAMES = 97;
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
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const img = imgRef.current;
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

    /** Dibuja la posición fraccionaria `pos`, mezclando los dos cuadros vecinos para que el giro sea continuo. */
    const draw = (pos: number) => {
      const key = Math.round(pos * 8); // 8 pasos entre cuadros
      if (key === drawn) return;
      const p = key / 8;
      const lo = Math.floor(p);
      const a = p - lo;
      const j0 = nearest(lo);
      if (j0 < 0) return;
      const b0 = bitmaps[j0]!;
      if (canvas.width !== b0.width) {
        canvas.width = b0.width;
        canvas.height = b0.height;
      }
      ctx.globalAlpha = 1;
      ctx.drawImage(b0, 0, 0);
      if (a > 0) {
        const j1 = nearest(Math.min(lo + 1, FRAMES - 1));
        if (j1 >= 0 && j1 !== j0) {
          ctx.globalAlpha = a;
          ctx.drawImage(bitmaps[j1]!, 0, 0);
          ctx.globalAlpha = 1;
        }
      }
      drawn = key;
      if (img) img.style.opacity = "0"; // el cuadro de respaldo ya no hace falta
    };
    const tick = (now: number) => {
      raf = 0;
      const dt = last ? Math.min((now - last) / 16.667, 4) : 1;
      last = now;
      current += (target - current) * (1 - Math.pow(1 - LERP, dt));
      if (Math.abs(target - current) < 0.01) current = target;
      draw(current);
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
          if (Math.abs(i - current) < 2) {
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
    "absolute inset-0 h-full w-full object-cover object-[60%_center] ";

  return (
    <div ref={wrapRef} className={cn("relative overflow-hidden [mask-image:linear-gradient(to_right,transparent_0%,black_30%)]", className)}>
      {/* Cuadro de frente: se ve al instante, mientras cargan los demás y con movimiento reducido */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} src={src(REST)} alt="Chef de costea" className={media} fetchPriority="high" />
      <canvas ref={canvasRef} aria-hidden className={media} />
    </div>
  );
}

