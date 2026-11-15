import { Boxes, Calculator, CalendarClock, ChefHat, FileCheck2, Package, Receipt, ShoppingCart, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { KardexDemo, PriceDemo, RecipeDemo } from "@/components/landing/feature-demos";
import { SectionHeading } from "@/components/landing/section-heading";
import { card, container, panel, section } from "@/components/landing/styles";
import { Reveal, Stagger } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

function Demo({
  icon: Icon,
  title,
  text,
  children,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <article className={cn(card, "flex h-full flex-col p-5 sm:col-span-2 sm:p-6")}>
      <span className="grid size-11 place-items-center rounded-2xl bg-brand-600 text-lime-500">
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="mt-4 font-brand text-xl font-extrabold text-heading">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{text}</p>
      <div className={cn(panel, "mt-5 flex-1 p-4")}>{children}</div>
    </article>
  );
}

const more: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Package, title: "Insumos y precios", text: "Tu catálogo con versiones de precio, para saber cuánto costaba cada cosa en cada momento." },
  { icon: Users, title: "Personal", text: "Registra tu planilla y calcula el costo de la mano de obra directa e indirecta." },
  { icon: Receipt, title: "Gastos", text: "Costos indirectos, gastos de administración y de ventas en un solo lugar." },
  { icon: CalendarClock, title: "Plan de producción", text: "Planea cuántos platos preparar y cuánto necesitarás de cada insumo." },
  { icon: FileCheck2, title: "Presupuestos", text: "Presupuestos mensuales que, al publicarse, quedan fijos para compararlos con lo real." },
  { icon: ShoppingCart, title: "Ventas", text: "Registra lo vendido y mira ingresos, costos y utilidad del mes." },
];

export function Features() {
  return (
    <section id="incluye" className={section}>
      <div className={container}>
        <Reveal>
          <SectionHeading
            eyebrow="Todo en un solo lugar"
            title="Qué"
            accent="incluye"
            text="Desde el kilo de pescado hasta el precio de la carta. Prueba las demos: son los mismos cálculos que usa el sistema."
          />
        </Reveal>

        {/* Bento: 3 demos grandes y 6 tarjetas chicas en una sola rejilla. Las chicas son informativas, sin hover. */}
        <Stagger className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Demo icon={ChefHat} title="Platos y recetas" text="Arma cada plato con sus ingredientes. Si cambia un precio, el costo se recalcula.">
            <RecipeDemo />
          </Demo>
          <Demo icon={Calculator} title="Costo y precio por plato" text="Elige el margen y obtén el precio sugerido con IGV, con la fórmula del sistema.">
            <PriceDemo />
          </Demo>
          <Demo icon={Boxes} title="Inventario" text="Kardex con costo promedio ponderado: cada compra actualiza el costo de tus insumos.">
            <KardexDemo />
          </Demo>
          {more.map(({ icon: Icon, title, text }) => (
            <article key={title} className={cn(card, "flex h-full gap-4 p-5 lg:col-span-2")}>
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-brand text-lg font-extrabold text-heading">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{text}</p>
              </div>
            </article>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
