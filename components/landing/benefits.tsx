import { Check } from "lucide-react";
import { BenefitsDemo } from "@/components/landing/benefits-demo";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-heading";

const gains = [
  "Saber el costo real de cada plato, con insumos, mano de obra y gastos.",
  "Fijar precios con el margen que tú decides, con IGV del 18 % incluido.",
  "Detectar qué platos te dejan más y cuáles te dejan poco.",
  "Planear la producción y las compras de cada mes sin adivinar.",
  "Tener tus números ordenados en un solo lugar, separados por restaurante.",
];

export function Benefits() {
  return (
    <section className="bg-cream-100 py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
        <div>
          <Reveal>
            <SectionHeading eyebrow="Para decidir con números" title="Qué ganas" />
          </Reveal>
          <ul className="mt-8 space-y-3">
            {gains.map((g, i) => (
              <Reveal key={g} delay={i * 90}>
                <li className="flex gap-3.5 rounded-2xl bg-white/80 p-4 ring-1 ring-cream-300/70">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-lime-500 text-heading">
                    <Check className="size-4" strokeWidth={3} aria-hidden />
                  </span>
                  <span className="font-medium text-heading">{g}</span>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
        <Reveal delay={150}>
          <BenefitsDemo />
        </Reveal>
      </div>
    </section>
  );
}
