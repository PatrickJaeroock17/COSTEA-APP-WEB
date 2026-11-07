import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";

export function ClosingCta() {
  return (
    <section className="bg-cream px-4 pb-6 pt-4 sm:px-6">
      <div className="relative mx-auto flex min-h-[460px] max-w-7xl overflow-hidden rounded-[36px] bg-[#032a1f]">
        <div aria-hidden className="pointer-events-none absolute -left-20 -top-20 size-[420px] rounded-full bg-[#a9d63a]/20 blur-3xl" />
        {/* El chef asoma por la derecha y se funde con el verde */}
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 w-full opacity-40 [mask-image:linear-gradient(to_right,transparent_5%,#000_70%)] md:w-[62%] md:opacity-100"
        >
          <Image
            src="/chef/f051.webp"
            alt=""
            fill
            sizes="(min-width: 768px) 62vw, 100vw"
            className="object-cover object-[55%_0%]"
          />
        </div>
        <div className="relative z-10 flex w-full flex-col justify-center px-6 py-14 sm:px-12 md:max-w-[58%] md:py-20 lg:px-16">
          <Reveal>
            <h2 className="font-brand text-4xl font-extrabold leading-[1.05] tracking-[-0.025em] text-white sm:text-5xl">
              Empieza a costear tu carta hoy.
            </h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-[#cfe3da]">
              Crea tu cuenta y registra tu primer plato.
            </p>
            <Link
              href="/registro"
              className="mt-8 inline-flex min-h-14 items-center gap-6 rounded-full bg-[#a9d63a] pl-7 pr-2 text-base font-extrabold text-[#032a1f] transition-colors hover:bg-[#bfe05f]"
            >
              Crear mi cuenta
              <span className="grid size-10 place-items-center rounded-full bg-[#032a1f] text-[#a9d63a]" aria-hidden>
                <ArrowUpRight className="size-5" strokeWidth={2.4} />
              </span>
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}


