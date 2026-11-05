"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// Cuadros del video de Kling (1440×812, 97 cuadros, 4.04 s) en public/chef/f001.webp … f097.webp
const FRAMES = 97;
const D = 4.04; // duración del video original, en segundos
const TF = D * 0.52; // instante de frente
const LERP = 0.14; // por cuadro a 60 Hz
const POS_X = 0.35; // object-position: 35% 50%
const POS_Y = 0.5;
const CONCURRENCY = 6;

const REST = Math.round((TF / D) * (FRAMES - 1));
const src = (i: number) => `/chef/f${String(i + 1).padStart(3, "0")}.webp`;

const FADE = "linear-gradient(to right, transparent 0%, #000 34%)";

/**
 * Capa del chef (detrás del hero). Los cuadros del video se precargan como ImageBitmap y se dibujan
 * en un <canvas> replicando `object-fit: cover; object-position: 35% 50%`.
 * El cursor se mide sobre TODA la sección (el <section> padre): ver mapeo en brand/HERO-REFERENCIA.md.
 */
export function ChefScrub({ className }: { className?: string }) {
  const layerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const hero = layer?.closest("section");
    const ctx = canvas?.getContext("2d");
    if (!layer || !canvas || !hero || !ctx) return;

    // Solo el cuadro de frente (el <img>), sin seguimiento.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // En móvil, uno de cada dos cuadros.
    const step = window.matchMedia("(max-width: 767px)").matches ? 2 : 1;
    const order = [REST, 0, FRAMES - 1, ...Array.from({ length: FRAMES }, (_, i) => i)]
      .filter((i, k, a) => a.indexOf(i) === k && (i % step === 0 || i === REST || i === FRAMES - 1))
      .sort((a, b) => (a === REST ? -1 : b === REST ? 1 : Math.abs(a - REST) - Math.abs(b - REST)));

    const bitmaps: (ImageBitmap | undefined)[] = new Array(FRAMES);
    const ac = new AbortController();
    let target = TF; // segundos
    let cur = TF;
    let drawnIndex = -1;
    let raf = 0;
    let last = 0;
    let alive = true;

    const nearest = (i: number) => {
      for (let d = 0; d < FRAMES; d++) {
        if (bitmaps[i - d]) return i - d;
        if (bitmaps[i + d]) return i + d;
      }
      return -1;
    };

    /** drawImage con recorte equivalente a object-fit: cover + object-position. */
    const paint = (index: number) => {
      const j = nearest(index);
      if (j < 0 || (j === drawnIndex && canvas.width > 0)) return;
      const bmp = bitmaps[j]!;
      const cw = canvas.width;
      const ch = canvas.height;
      if (!cw || !ch) return;
      const scale = Math.max(cw / bmp.width, ch / bmp.height);
      const sw = cw / scale;
      const sh = ch / scale;
      const sx = (bmp.width - sw) * POS_X;
      const sy = (bmp.height - sh) * POS_Y;
      ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, cw, ch);
      drawnIndex = j;
      if (img) img.style.opacity = "0";
    };

    const currentIndex = () => Math.round((cur / D) * (FRAMES - 1));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = layer.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      drawnIndex = -1;
      paint(currentIndex());
    };
    const ro = new ResizeObserver(resize);
    ro.observe(layer);

    const tick = (now: number) => {
      raf = 0;
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
      last = now;
      cur += (target - cur) * (1 - Math.pow(1 - LERP, dt * 60));
      if (Math.abs(target - cur) < 0.0005) cur = target;
      paint(currentIndex()); // solo redibuja si cambió el índice entero
      if (cur !== target) raf = requestAnimationFrame(tick);
      else last = 0;
    };
    const kick = () => {
      if (!raf && alive) raf = requestAnimationFrame(tick);
    };

    let next = 0;
    const worker = async () => {
      while (alive && next < order.length) {
        const i = order[next++];
        try {
          const res = await fetch(src(i), { signal: ac.signal });
          const bmp = await createImageBitmap(await res.blob());
          if (!alive) return bmp.close();
          bitmaps[i] = bmp;
          if (Math.abs(i - currentIndex()) < 2 || drawnIndex < 0) {
            drawnIndex = -1;
            kick();
          }
        } catch {
          if (!alive) return;
        }
      }
    };
    for (let k = 0; k < CONCURRENCY; k++) void worker();

    // Cursor medido sobre TODA la sección.
    const aim = (clientX: number) => {
      const r = hero.getBoundingClientRect();
      const x = clientX - r.left;
      const cx = r.width * 0.64;
      if (x < cx) {
        const k = Math.max(0, Math.min(1, x / cx));
        target = 0.02 + (TF - 0.02) * k;
      } else {
        const k = Math.max(0, Math.min(1, (x - cx) / (r.width - cx)));
        target = TF + (D - 0.05 - TF) * k;
      }
      kick();
    };
    const onMove = (e: PointerEvent) => aim(e.clientX);
    const onTouch = (e: TouchEvent) => {
      if (e.touches[0]) aim(e.touches[0].clientX);
    };
    const onLeave = () => {
      target = TF;
      kick();
    };

    hero.addEventListener("pointermove", onMove as EventListener, { passive: true });
    hero.addEventListener("touchmove", onTouch as EventListener, { passive: true });
    hero.addEventListener("pointerleave", onLeave);

    return () => {
      alive = false;
      ac.abort();
      ro.disconnect();
      cancelAnimationFrame(raf);
      hero.removeEventListener("pointermove", onMove as EventListener);
      hero.removeEventListener("touchmove", onTouch as EventListener);
      hero.removeEventListener("pointerleave", onLeave);
      bitmaps.forEach((b) => b?.close());
    };
  }, []);

  return (
    <div
      ref={layerRef}
      aria-hidden
      className={cn("pointer-events-none overflow-hidden", className)}
      style={{ maskImage: FADE, WebkitMaskImage: FADE }}
    >
      {/* Cuadro de frente: visible al instante, mientras llegan los demás y con movimiento reducido */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src(REST)}
        alt=""
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: "35% 50%" }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
