import Link from "next/link";
import { Reveal } from "@/components/landing/reveal";

function Ghost({ delay }: { delay: number }) {
  return (
    <div
      style={{ animationDelay: `${delay}ms` }}
      className="plan-ghost rounded-3xl border border-dashed border-white/20 bg-white/[0.04] p-6"
      aria-hidden
    >
      <div className="h-4 w-24 rounded-full bg-white/15" />
      <div className="mt-5 h-9 w-32 rounded-xl bg-white/10" />
      <div className="mt-6 space-y-3">
        <div className="h-3 w-full rounded-full bg-white/10" />
        <div className="h-3 w-5/6 rounded-full bg-white/10" />
        <div className="h-3 w-2/3 rounded-full bg-white/10" />
      </div>
    </div>
  );
}

export function Plans() {
  return (
    <section id="planes" className="relative scroll-mt-4 overflow-hidden bg-[#032a1f] py-20 sm:py-28">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 size-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#a9d63a]/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 right-0 size-[520px] rounded-full bg-[#006b4b]/60 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-block rounded-full bg-white/10 px-3.5 py-[7px] text-[13px] font-bold text-[#d8ee9c]">
            Próximamente
          </span>
          <h2 className="mt-4 font-brand text-4xl font-extrabold leading-[1.05] tracking-[-0.025em] text-white sm:text-5xl">
            Planes
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-[#cfe3da]">
            Estamos definiendo los planes y sus precios. Crea tu cuenta y te avisaremos cuando estén disponibles.
          </p>
          <Link
            href="/registro"
            className="mt-8 inline-flex min-h-14 items-center rounded-full bg-[#a9d63a] px-8 text-base font-extrabold text-[#032a1f] transition-colors hover:bg-[#bfe05f]"
          >
            Crear mi cuenta
          </Link>
        </Reveal>

        <Reveal delay={150} className="mt-14 grid gap-5 md:grid-cols-3">
          <Ghost delay={0} />
          <Ghost delay={250} />
          <Ghost delay={500} />
        </Reveal>
      </div>
    </section>
  );
}
