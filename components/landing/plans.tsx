import Link from "next/link";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { cn, focusRingDark } from "@/lib/utils";

/** Planes aún sin definir: un bloque compacto con el aviso y el registro (sin precios ni contenido inventado). */
export function Plans() {
  return (
    <section id="planes" className="relative scroll-mt-4 overflow-hidden bg-brand-900 py-20 sm:py-24">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 size-155 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime-500/20 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <SectionHeading
            tone="dark"
            eyebrow="Próximamente"
            title="Planes"
            text="Estamos definiendo los planes y sus precios. Crea tu cuenta y te avisaremos cuando estén disponibles."
          />
          <Link
            href="/registro"
            className={cn(buttonVariants({ shape: "pill", size: "xl" }), "mt-8 bg-lime-500 px-8 text-brand-900 hover:bg-lime-400", focusRingDark)}
          >
            Crear mi cuenta
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
