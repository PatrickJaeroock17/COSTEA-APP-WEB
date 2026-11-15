"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image, { type StaticImageData } from "next/image";
import { useReducedMotion } from "motion/react";
import { mediaFrame } from "@/components/landing/styles";
import { cn } from "@/lib/utils";

/**
 * Fotos y videos reales de la landing (DESIGN.md §13, "Medios"). Créditos en `public/media/CREDITOS.md`.
 * Todo va dentro de un marco con `overflow-hidden` y proporción reservada (sin CLS); solo se animan transform y opacity.
 */

/** Velo verde de marca sobre la foto. `soft` apenas tiñe; `base` oscurece el pie para apoyar un panel encima. */
const tints = {
  none: "",
  soft: "bg-linear-to-t from-brand-900/30 via-brand-900/5 to-transparent",
  base: "bg-linear-to-t from-brand-900/70 via-brand-900/15 to-transparent",
} as const;

export function Tint({ tone }: { tone: keyof typeof tints }) {
  if (tone === "none") return null;
  return <div aria-hidden className={cn("pointer-events-none absolute inset-0", tints[tone])} />;
}

/** Foto dentro del marco común, con velo de marca opcional. */
export function Photo({
  src,
  alt,
  sizes,
  className,
  imageClassName,
  tint = "none",
}: {
  src: StaticImageData;
  alt: string;
  sizes: string;
  className?: string;
  imageClassName?: string;
  tint?: keyof typeof tints;
  shift?: 0 | 12 | 24;
}) {
  return (
    <div className={cn(mediaFrame, className)}>
      <Image src={src} alt={alt} fill sizes={sizes} placeholder="blur" className={cn("object-cover", imageClassName)} />
      <Tint tone={tint} />
    </div>
  );
}

type Connection = { saveData?: boolean; effectiveType?: string };
const noop = () => () => {};
/** false en el servidor, con ahorro de datos activado o en redes 2G: ahí solo se muestra el póster. */
function useCanLoadVideo() {
  return useSyncExternalStore(
    noop,
    () => {
      const c = (navigator as Navigator & { connection?: Connection }).connection;
      return !(c?.saveData || /2g/.test(c?.effectiveType ?? ""));
    },
    () => false,
  );
}

/**
 * Video corto en bucle, mudo. El póster (foto optimizada) está siempre; el `<video>` solo se monta la primera vez
 * que el marco entra en pantalla, y se pausa al salir. No se monta con `prefers-reduced-motion`, con ahorro de datos
 * ni sin JS: en esos casos queda el póster.
 */
export function LoopVideo({
  mp4,
  webm,
  poster,
  posterSrc,
  alt,
  sizes,
  className,
  videoClassName,
  children,
}: {
  mp4: string;
  webm?: string;
  /** Póster optimizado (import estático) que se ve antes de cargar el video y cuando no se carga. */
  poster: StaticImageData;
  /** El mismo póster como ruta pública, para el atributo `poster` del `<video>`. */
  posterSrc: string;
  alt: string;
  sizes: string;
  className?: string;
  videoClassName?: string;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();
  const canLoad = useCanLoadVideo();
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const enabled = canLoad && !reduced;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const io = new IntersectionObserver(
      ([e]) => {
        setVisible(e.isIntersecting);
        if (e.isIntersecting) setMounted(true);
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (visible) v.play().catch(() => {});
    else v.pause();
  }, [visible, mounted]);

  return (
    <div ref={ref} className={className}>
      <Image src={poster} alt={alt} fill sizes={sizes} placeholder="blur" className={cn("object-cover", videoClassName)} />
      {enabled && mounted && (
        <video
          ref={video}
          muted
          autoPlay
          loop
          playsInline
          preload="none"
          poster={posterSrc}
          aria-hidden
          tabIndex={-1}
          onPlaying={() => setPlaying(true)}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-300",
            playing ? "opacity-100" : "opacity-0",
            videoClassName,
          )}
        >
          {webm && <source src={webm} type="video/webm" />}
          <source src={mp4} type="video/mp4" />
        </video>
      )}
      {children}
    </div>
  );
}
