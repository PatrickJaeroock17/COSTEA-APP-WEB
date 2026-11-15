import { CakeSlice, Coffee, CupSoda, Drumstick, Fish, Pizza, Soup, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { card, container } from "@/components/landing/styles";
import { InView } from "@/components/motion/in-view";
import { Reveal } from "@/components/motion/reveal";
import { Marquee } from "@/components/ui/marquee";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";

/**
 * Franja bajo la portada: cifras del propio producto (no de clientes) y tipos de negocio a los que sirve.
 * Sin testimonios, logos ni reseñas (CLAUDE.md).
 */
const facts: { value?: number; suffix?: string; word?: string; label: string }[] = [
  { value: 9, label: "funciones en un solo lugar, de los insumos a los presupuestos" },
  { value: 18, suffix: " %", label: "de IGV incluido en cada precio sugerido" },
  { value: 4, label: "pasos para tener tu carta costeada" },
  { word: "Al instante", label: "se recalcula el costo por plato cuando cambia un precio" },
];

const kinds: { icon: LucideIcon; label: string }[] = [
  { icon: Fish, label: "Cevicherías" },
  { icon: Drumstick, label: "Pollerías" },
  { icon: Soup, label: "Chifas" },
  { icon: Coffee, label: "Cafés" },
  { icon: CakeSlice, label: "Pastelerías" },
  { icon: UtensilsCrossed, label: "Restaurantes" },
  { icon: Pizza, label: "Pizzerías" },
  { icon: CupSoda, label: "Juguerías" },
];

export function ProofStrip() {
  return (
    <section aria-label="Costea en cifras" className="relative pt-4 sm:pt-5">
      <div className={container}>
        <Reveal>
          <dl className={cn(card, "grid grid-cols-2 lg:grid-cols-4")}>
            {facts.map((f, i) => (
              <div
                key={f.label}
                className={cn(
                  "flex flex-col-reverse justify-end gap-1 border-line-soft p-5 sm:p-6",
                  i % 2 === 1 && "border-l",
                  i > 1 && "border-t lg:border-t-0",
                  i === 2 && "lg:border-l",
                )}
              >
                <dt className="text-sm leading-snug text-ink-soft">{f.label}</dt>
                <dd className="font-brand text-4xl leading-none font-extrabold tracking-title text-heading sm:text-5xl">
                  {f.value !== undefined ? (
                    <>
                      <NumberTicker value={f.value} />
                      {f.suffix && <span className="text-primary">{f.suffix}</span>}
                    </>
                  ) : (
                    <span className="text-3xl text-primary sm:text-4xl">{f.word}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <InView className="mt-5 flex items-center gap-4">
          <p className="hidden shrink-0 text-small font-semibold text-muted-foreground sm:block">Pensado para</p>
          <Marquee
            pauseOnHover
            className="min-w-0 flex-1 [--duration:45s] [--gap:0.625rem] [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
          >
            {kinds.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink"
              >
                <Icon className="size-4 text-primary" aria-hidden /> {label}
              </span>
            ))}
          </Marquee>
        </InView>
      </div>
    </section>
  );
}
