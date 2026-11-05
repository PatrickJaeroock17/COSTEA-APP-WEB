"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const REST = 0.52; // proporción de la duración donde el chef mira de frente
const LERP = 0.24;

/**
 * Video del chef que NO se reproduce: se mueve `currentTime` según la posición
 * horizontal del cursor (o del dedo) respecto al chef.
 */
export function ChefScrub({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const video = videoRef.current;
    if (!wrap || !video) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let target = 0; // segundos
    let current = 0;
    let raf = 0;

    const duration = () => (Number.isFinite(video.duration) ? video.duration : 0);

    const setRest = () => {
      target = current = duration() * REST;
      video.currentTime = current;
    };

    let last = 0;
    const tick = (now: number) => {
      raf = 0;
      // Suavizado independiente de la tasa de cuadros (referencia: 60 fps).
      const dt = last ? Math.min((now - last) / 16.667, 4) : 1;
      last = now;
      const k = 1 - Math.pow(1 - LERP, dt);
      current += (target - current) * k;
      if (Math.abs(target - current) < 0.004) current = target;
      // No encolar saltos: solo buscar un nuevo cuadro cuando el anterior terminó.
      if (!video.seeking && Math.abs(video.currentTime - current) > 0.001) video.currentTime = current;
      if (current !== target || video.seeking) raf = requestAnimationFrame(tick);
      else last = 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const aim = (clientX: number) => {
      const d = duration();
      if (!d) return;
      const r = wrap.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      // Distancia al centro del chef, normalizada: ±0.5 anchos = giro completo.
      const reach = Math.max(r.width * 0.5, 1);
      const s = Math.max(-1, Math.min(1, (clientX - cx) / reach));
      const rest = d * REST;
      target = s < 0 ? rest + s * rest : rest + s * (d - rest);
      kick();
    };

    const onMove = (e: PointerEvent) => aim(e.clientX);
    const onTouch = (e: TouchEvent) => {
      if (e.touches[0]) aim(e.touches[0].clientX);
    };
    const onLeave = () => {
      target = duration() * REST;
      kick();
    };

    const onReady = () => {
      video.pause();
      setRest();
    };

    video.pause();
    if (video.readyState >= 1) onReady();
    else video.addEventListener("loadedmetadata", onReady, { once: true });

    if (!reduced) {
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("touchmove", onTouch, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("touchmove", onTouch);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      video.removeEventListener("loadedmetadata", onReady);
    };
  }, []);

  return (
    <div ref={wrapRef} className={cn("relative overflow-hidden", className)}>
      <video
        ref={videoRef}
        src="/video/costea-chef-scrub.mp4"
        muted
        playsInline
        preload="auto"
        tabIndex={-1}
        aria-label="Chef de costea que mira hacia donde mueves el cursor"
        className="absolute inset-0 h-full w-full object-cover object-[60%_center] [mask-image:linear-gradient(to_right,transparent_0%,black_30%)]"
      />
    </div>
  );
}


