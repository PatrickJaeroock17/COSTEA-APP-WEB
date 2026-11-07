"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Escritorio: 97 cuadros 1440×812 en /chef. Móvil: los mismos 97 cuadros recortados a 650×812 alrededor del chef en /chef-m.
const FRAMES = 97;
const D = 4.04; // duración del video original, en segundos
const TF = D * 0.52; // instante de frente
const LERP = 0.14; // por cuadro a 60 Hz
const CONCURRENCY = 6;
const SCROLL_TRAVEL = 1300; // px de recorrido del scroll en móvil (HERO-MOVIL.md pedía 760; más largo = giro más lento)

const REST = Math.round((TF / D) * (FRAMES - 1));
const frameUrl = (dir: string, i: number) => `${dir}/f${String(i + 1).padStart(3, "0")}.webp`;

type Mode = "desktop" | "mobile";

/**
 * Capa del chef (detrás del hero). Cuadros precargados como ImageBitmap y dibujados en un <canvas>
 * con recorte equivalente a `object-fit: cover`.
 * - Escritorio: el cursor se mide sobre TODA la sección (HERO-REFERENCIA.md).
 * - Móvil: el scroll de la escena anclada decide el cuadro (HERO-MOVIL.md); `--p` (0..1) queda en la sección.
 */
export function ChefScrub({ className }: { className?: string }) {
  const layerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setMode(mq.matches ? "desktop" : "mobile");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    const canvas = canvasRef.current;
    const hero = layer?.closest("section");
    const ctx = canvas?.getContext("2d");
    if (!mode || !layer || !canvas || !hero || !ctx) return;

    // Solo el cuadro de frente (los <img> de abajo), sin seguimiento.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const mobile = mode === "mobile";
    const dir = mobile ? "/chef-m" : "/chef";
    const posX = mobile ? 0.5 : 0.35;
    const t0 = mobile ? 0.02 : TF; // instante inicial
    const order = mobile
      ? Array.from({ length: FRAMES }, (_, i) => i) // el scroll avanza desde el cuadro 0
      : [REST, 0, FRAMES - 1, ...Array.from({ length: FRAMES }, (_, i) => i)
          .filter((i) => i !== REST && i !== 0 && i !== FRAMES - 1)
          .sort((a, b) => Math.abs(a - REST) - Math.abs(b - REST))];

    const bitmaps: (ImageBitmap | undefined)[] = new Array(FRAMES);
    const ac = new AbortController();
    let target = t0;
    let cur = t0;
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

    const paint = (index: number) => {
      const j = nearest(index);
      if (j < 0 || j === drawnIndex) return;
      const bmp = bitmaps[j]!;
      const cw = canvas.width;
      const ch = canvas.height;
      if (!cw || !ch) return;
      const scale = Math.max(cw / bmp.width, ch / bmp.height);
      const sw = cw / scale;
      const sh = ch / scale;
      ctx.drawImage(bmp, (bmp.width - sw) * posX, (bmp.height - sh) * 0.5, sw, sh, 0, 0, cw, ch);
      drawnIndex = j;
      layer.querySelectorAll("img").forEach((im) => ((im as HTMLElement).style.opacity = "0"));
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
          const res = await fetch(frameUrl(dir, i), { signal: ac.signal });
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

    const cleanups: (() => void)[] = [];

    if (mobile) {
      // Scroll de la escena anclada → instante del video; --p alimenta la barra de progreso y el aviso.
      const onScroll = () => {
        const r = hero.getBoundingClientRect();
        const range = Math.max(Math.min(r.height - window.innerHeight, SCROLL_TRAVEL), 1);
        const p = Math.max(0, Math.min(1, -r.top / range));
        hero.style.setProperty("--p", p.toFixed(4));
        target = 0.02 + (D - 0.05 - 0.02) * p;
        kick();
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      onScroll();
      cur = target; // sin "viaje" inicial si la página carga ya desplazada
      cleanups.push(() => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      });
    } else {
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
      cleanups.push(() => {
        hero.removeEventListener("pointermove", onMove as EventListener);
        hero.removeEventListener("touchmove", onTouch as EventListener);
        hero.removeEventListener("pointerleave", onLeave);
      });
    }

    return () => {
      alive = false;
      ac.abort();
      ro.disconnect();
      cancelAnimationFrame(raf);
      cleanups.forEach((fn) => fn());
      bitmaps.forEach((b) => b?.close());
    };
  }, [mode]);

  const img = "absolute inset-0 h-full w-full object-cover";

  return (
    <div ref={layerRef} aria-hidden className={cn("chef-fade pointer-events-none overflow-hidden", className)}>
      {/* Cuadros de frente: visibles al instante, mientras cargan los demás y con movimiento reducido */}
      {/* eslint-disable @next/next/no-img-element */}
      <img
        src={frameUrl("/chef", REST)}
        alt=""
        fetchPriority="high"
        className={cn(img, "hidden object-[35%_50%] md:block")}
      />
      <img src={frameUrl("/chef-m", REST)} alt="" fetchPriority="high" className={cn(img, "object-[50%_50%] md:hidden")} />
      {/* eslint-enable @next/next/no-img-element */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}

