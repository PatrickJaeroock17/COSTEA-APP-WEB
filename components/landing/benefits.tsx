import { Check } from "lucide-react";
import { BenefitsDemo } from "@/components/landing/benefits-demo";
import { Reveal } from "@/components/landing/reveal";

const gains = [
  "Saber el costo real de cada plato, con insumos, mano de obra y gastos.",
  "Fijar precios con el margen que tú decides, con IGV del 18 % incluido.",
  "Detectar qué platos te dejan más y cuáles te dejan poco.",
  "Planear la producción y las compras de cada mes sin adivinar.",
  "Tener tus números ordenados en un solo lugar, separados por restaurante.",
];

export function Benefits() {
  return (
    <section className="relative overflow-hidden bg-cream py-20 sm:py-28">
      <div aria-hidden className="pointer-events-none absolute -left-32 bottom-0 size-[420px] rounded-full bg-[#a9d63a]/20 blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
        <div>
          <Reveal>
            <span className="inline-block rounded-full bg-white/70 px-3.5 py-[7px] text-[13px] font-bold text-[#00563d]">
              Para decidir con números
            </span>
            <h2 className="mt-4 font-brand text-4xl font-extrabold leading-[1.05] tracking-[-0.025em] text-[#032a1f] sm:text-5xl">
              Qué ganas
            </h2>
          </Reveal>
          <ul className="mt-8 space-y-3">
            {gains.map((g, i) => (
              <Reveal key={g} delay={i * 90}>
                <li className="flex gap-3.5 rounded-2xl bg-white/80 p-4 ring-1 ring-[#ead9b3]/70">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[#a9d63a] text-[#032a1f]">
                    <Check className="size-4" strokeWidth={3} aria-hidden />
                  </span>
                  <span className="font-medium text-[#032a1f]">{g}</span>
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
