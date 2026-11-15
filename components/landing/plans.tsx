import Link from "next/link";
import { SectionHeading } from "@/components/landing/section-heading";
import { card, container, section } from "@/components/landing/styles";
import { Reveal } from "@/components/motion/reveal";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Planes aún sin definir: una tarjeta compacta dentro del flujo con el aviso y el registro (sin precios ni contenido inventado). */
export function Plans() {
  return (
    <section id="planes" className={section}>
      <div className={container}>
        <Reveal>
          <div className={cn(card, "flex flex-col gap-6 p-6 sm:p-8 md:flex-row md:items-center md:justify-between md:gap-10 lg:p-10")}>
            <SectionHeading
              eyebrow="Próximamente"
              title="Planes"
              text="Estamos definiendo los planes y sus precios. Crea tu cuenta y te avisaremos cuando estén disponibles."
              textClassName="max-w-xl"
            />
            <Link href="/registro" className={cn(buttonVariants({ shape: "pill", size: "xl" }), "btn-sheen shrink-0 px-8")}>
              Crear mi cuenta
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
