import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/landing/reveal";
import { CtaArrow, buttonVariants } from "@/components/ui/button";
import { cn, focusRingDark } from "@/lib/utils";

export function ClosingCta() {
  return (
    <section className="bg-cream-100 px-4 pb-6 pt-4 sm:px-6">
      <div className="relative mx-auto flex min-h-115 max-w-7xl overflow-hidden rounded-5xl bg-brand-900">
        {/* El chef asoma por la derecha y se funde con el verde */}
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 w-full opacity-40 [mask-image:linear-gradient(to_right,transparent_5%,black_70%)] md:w-[62%] md:opacity-100"
        >
          <Image src="/chef/f051.webp" alt="" fill sizes="(min-width: 768px) 62vw, 100vw" className="object-cover object-[55%_0%]" />
        </div>
        <div className="relative z-10 flex w-full flex-col justify-center px-6 py-14 sm:px-12 md:max-w-[58%] md:py-20 lg:px-16">
          <Reveal>
            <h2 className="font-brand text-4xl leading-display font-extrabold tracking-display text-white sm:text-5xl">Empieza a costear tu carta hoy.</h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-sidebar-foreground">Crea tu cuenta y registra tu primer plato.</p>
            <Link href="/registro" className={cn(buttonVariants({ variant: "cta-lime" }), "mt-8", focusRingDark)}>
              Crear mi cuenta
              <CtaArrow tone="dark" />
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
