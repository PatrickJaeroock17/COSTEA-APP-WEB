"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { SectionHeading } from "@/components/landing/section-heading";
import { container, section } from "@/components/landing/styles";
import { EASE, Reveal, Stagger } from "@/components/motion/reveal";
import { cn, focusRing } from "@/lib/utils";

const faqs = [
  { q: "¿Para qué tipo de negocio sirve?", a: "Para restaurantes y cevicherías que quieren conocer el costo de sus platos y su margen. Los datos y la moneda están pensados para Perú (soles, IGV 18 %)." },
  { q: "¿Necesito instalar algo?", a: "No. Costea funciona desde el navegador, en computadora o en celular." },
  { q: "¿Puedo manejar más de un restaurante?", a: "Sí. Cada restaurante tiene sus propios datos y tú eliges cuál ver desde el menú superior." },
  { q: "¿Mis datos están separados de los de otros?", a: "Sí. Cada restaurante ve solamente su información." },
  { q: "¿Qué pasa si cambia el precio de un insumo?", a: "Guardamos versiones de precio, así que puedes ver cómo cambió el costo de tus platos en el tiempo." },
  { q: "¿Cuánto cuesta?", a: "Los planes todavía están por definir. Crea tu cuenta y te avisaremos." },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const reduced = useReducedMotion();

  return (
    <section id="preguntas" className={section}>
      <div className={cn(container, "grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16")}>
        <Reveal>
          <SectionHeading eyebrow="Dudas frecuentes" title="Preguntas" text="Lo básico antes de empezar a costear tu carta." textClassName="max-w-sm" />
        </Reveal>

        <Stagger className="space-y-2.5">
          {faqs.map((f, i) => {
            const on = open === i;
            return (
              <div
                key={f.q}
                className={cn("rounded-3xl border border-line transition-[background-color,box-shadow] duration-300", on ? "bg-white shadow-card" : "bg-white/60 hover:bg-white")}
              >
                <h3>
                  <button
                    type="button"
                    onClick={() => setOpen(on ? null : i)}
                    aria-expanded={on}
                    aria-controls={`faq-${i}`}
                    className={cn("flex w-full items-center justify-between gap-4 rounded-3xl p-5 text-left sm:px-6", focusRing)}
                  >
                    <span className="font-brand text-lg font-extrabold text-heading">{f.q}</span>
                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-full transition-[rotate,background-color,color] duration-300",
                        on ? "rotate-45 bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
                      )}
                    >
                      <Plus className="size-4" strokeWidth={2.5} aria-hidden />
                    </span>
                  </button>
                </h3>
                {/* initial={false}: el servidor ya entrega la primera abierta y el resto cerradas, sin animación de carga */}
                <motion.div
                  id={`faq-${i}`}
                  role="region"
                  initial={false}
                  animate={{ height: on ? "auto" : 0, opacity: on ? 1 : 0 }}
                  transition={reduced ? { duration: 0 } : { duration: 0.35, ease: EASE }}
                  className="overflow-hidden"
                >
                  <p className="px-5 pb-5 text-body leading-relaxed text-ink-soft sm:px-6">{f.a}</p>
                </motion.div>
              </div>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}
