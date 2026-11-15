import { Check } from "lucide-react";
import { BenefitsDemo } from "@/components/landing/benefits-demo";
import { SectionHeading } from "@/components/landing/section-heading";
import { container, section } from "@/components/landing/styles";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

const gains = [
  "Saber el costo real de cada plato, con insumos, mano de obra y gastos.",
  "Fijar precios con el margen que tú decides, con IGV del 18 % incluido.",
  "Detectar qué platos te dejan más y cuáles te dejan poco.",
  "Planear la producción y las compras de cada mes sin adivinar.",
  "Tener tus números ordenados en un solo lugar, separados por restaurante.",
];

/** Lado claro (lista) frente a un panel verde oscuro (demo): el contraste de la sección (DESIGN.md §13). */
export function Benefits() {
  return (
    <section className={section}>
      <div className={cn(container, "grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16")}>
        <Reveal>
          <SectionHeading eyebrow="Para decidir con números" title="Qué" accent="ganas" />
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {gains.map((g) => (
              <li key={g} className="flex items-center gap-4 py-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-badge ring-1 ring-inset ring-white/20">
                  <Check className="size-5" strokeWidth={3} aria-hidden />
                </span>
                <span className="font-medium text-heading">{g}</span>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.1}>
          <BenefitsDemo />
        </Reveal>
      </div>
    </section>
  );
}
