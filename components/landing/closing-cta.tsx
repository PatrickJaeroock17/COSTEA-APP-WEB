import Image from "next/image";
import Link from "next/link";
import { container } from "@/components/landing/styles";
import { Reveal } from "@/components/motion/reveal";
import { CtaArrow, buttonVariants } from "@/components/ui/button";
import { cn, focusRingDark } from "@/lib/utils";

/** Cierre: el único bloque de color de la página, dentro de una tarjeta redondeada (DESIGN.md §13). */
export function ClosingCta() {
  return (
    <section className="py-section">
      <div className={container}>
        <Reveal>
          <div className="relative flex min-h-105 overflow-hidden rounded-5xl bg-brand-900">
            {/* El chef asoma por la derecha y se funde con el verde */}
            <div
              aria-hidden
              className="absolute inset-y-0 right-0 w-full opacity-40 [mask-image:linear-gradient(to_right,transparent_5%,black_70%)] md:w-[62%] md:opacity-100"
            >
              <Image src="/chef/f051.webp" alt="" fill sizes="(min-width: 768px) 62vw, 100vw" className="object-cover object-[55%_0%]" />
            </div>
            <div className="relative z-10 flex w-full flex-col justify-center px-6 py-14 sm:px-12 md:max-w-[58%] md:py-16 lg:px-16">
              <h2 className="font-brand text-4xl leading-display font-extrabold tracking-display text-white sm:text-5xl">Empieza a costear tu carta hoy.</h2>
              <p className="mt-4 max-w-md text-lg leading-relaxed text-sidebar-foreground">Crea tu cuenta y registra tu primer plato.</p>
              <Link href="/registro" className={cn(buttonVariants({ variant: "cta-lime" }), "btn-sheen mt-8 self-start", focusRingDark)}>
                Crear mi cuenta
                <CtaArrow tone="dark" />
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
