import { Aurora, DotGrid } from "@/components/landing/decor";
import { LoopVideo } from "@/components/landing/media";
import { cardDark, container } from "@/components/landing/styles";
import { InView } from "@/components/motion/in-view";
import { Parallax } from "@/components/motion/parallax";
import { Reveal } from "@/components/motion/reveal";
import { BorderBeam } from "@/components/ui/border-beam";
import { CtaArrow } from "@/components/ui/button";
import { ShimmerLink } from "@/components/ui/shimmer-button";
import { cn } from "@/lib/utils";
import poster from "@/public/media/cierre-emplatado-poster.jpg";

/**
 * Planes + cierre en un solo bloque verde oscuro (DESIGN.md §13): aurora, título grande, botón lima y un video de emplatado.
 * Los planes siguen sin definir: se mantiene el aviso, sin precios ni contenido inventado.
 */
export function ClosingCta() {
  return (
    <section id="planes" className="scroll-mt-nav py-section">
      <div className={container}>
        <Reveal>
          <InView className={cn(cardDark, "rounded-5xl")}>
            <Parallax className="absolute inset-0" distance={28}>
              <Aurora tone="dark" />
            </Parallax>
            <DotGrid tone="dark" />

            {/* Video de emplatado a la derecha, fundido hacia el verde. Encima, un velo de marca
                que deja el lado del texto en brand-900 casi pleno: el texto mantiene contraste AA. */}
            <LoopVideo
              mp4="/media/cierre-emplatado.mp4"
              webm="/media/cierre-emplatado.webm"
              poster={poster}
              posterSrc="/media/cierre-emplatado-poster.jpg"
              alt=""
              sizes="(min-width: 768px) 60vw, 100vw"
              className="absolute inset-y-0 right-0 w-full opacity-30 [mask-image:linear-gradient(to_right,transparent_0%,black_70%)] md:w-[62%] md:opacity-100"
              videoClassName="object-[60%_50%]"
            >
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-linear-to-r from-brand-900/90 via-brand-900/35 to-brand-700/15" />
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-linear-to-t from-brand-900/60 via-transparent to-brand-900/25" />
            </LoopVideo>

            <div className="relative z-10 flex flex-col px-6 py-12 sm:px-12 md:max-w-[60%] md:py-16 lg:px-16 lg:py-20">
              <span className="inline-flex items-center gap-2 self-start rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-small font-bold text-lime-300">
                <i aria-hidden className="size-1.5 rounded-full bg-lime-500" />
                Próximamente
              </span>
              <h2 className="mt-4 font-brand text-4xl leading-display font-extrabold tracking-display text-white sm:text-5xl lg:text-6xl">
                Empieza a costear tu carta hoy.
              </h2>
              <p className="mt-4 max-w-md text-lg leading-relaxed text-sidebar-foreground">Crea tu cuenta y registra tu primer plato.</p>

              <ShimmerLink href="/registro" tone="lime" className="mt-8 self-start">
                Crear mi cuenta
                <CtaArrow tone="dark" />
              </ShimmerLink>

              {/* Planes: tarjeta de cristal dentro del bloque */}
              <div className="mt-10 max-w-lg rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm sm:p-6">
                <h3 className="font-brand text-2xl font-extrabold text-white">Planes</h3>
                <p className="mt-1.5 text-body leading-relaxed text-sidebar-foreground">
                  Estamos definiendo los planes y sus precios. Crea tu cuenta y te avisaremos cuando estén disponibles.
                </p>
              </div>
            </div>
            <BorderBeam size={220} duration={12} />
          </InView>
        </Reveal>
      </div>
    </section>
  );
}
