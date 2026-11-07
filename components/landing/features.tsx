import { Boxes, Calculator, CalendarClock, ChefHat, FileCheck2, Package, Receipt, ShoppingCart, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { KardexDemo, PriceDemo, RecipeDemo } from "@/components/landing/feature-demos";
import { Reveal } from "@/components/landing/reveal";

const card =
  "rounded-[28px] border border-[#ead9b3]/70 bg-white shadow-[0_10px_30px_rgba(3,42,31,0.06)]";

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
    <article className={`${card} flex h-full flex-col p-6 sm:p-7`}>
      <span className="grid size-11 place-items-center rounded-2xl bg-[#006b4b] text-[#a9d63a]">
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="mt-4 font-brand text-xl font-extrabold text-[#032a1f]">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-[#3f524b]">{text}</p>
      <div className="mt-5 flex-1 rounded-2xl bg-[#faf3e0] p-4">{children}</div>
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
    <section id="incluye" className="relative scroll-mt-4 overflow-hidden bg-cream py-20 sm:py-28">
      <div aria-hidden className="pointer-events-none absolute -right-24 top-10 size-[420px] rounded-full bg-[#a9d63a]/20 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal>
          <span className="inline-block rounded-full bg-white/70 px-3.5 py-[7px] text-[13px] font-bold text-[#00563d]">
            Todo en un solo lugar
          </span>
          <h2 className="mt-4 max-w-2xl font-brand text-4xl font-extrabold leading-[1.05] tracking-[-0.025em] text-[#032a1f] sm:text-5xl">
            Qué incluye
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[#2c3f38]">
            Desde el kilo de pescado hasta el precio de la carta. Prueba las demos: son los mismos cálculos que usa el
            sistema.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          <Reveal>
            <Demo icon={ChefHat} title="Platos y recetas" text="Arma cada plato con sus ingredientes. Si cambia un precio, el costo se recalcula.">
              <RecipeDemo />
            </Demo>
          </Reveal>
          <Reveal delay={120}>
            <Demo icon={Calculator} title="Costo y precio por plato" text="Elige el margen y obtén el precio sugerido con IGV, con la fórmula del sistema.">
              <PriceDemo />
            </Demo>
          </Reveal>
          <Reveal delay={240}>
            <Demo icon={Boxes} title="Inventario" text="Kardex con costo promedio ponderado: cada compra actualiza el costo de tus insumos.">
              <KardexDemo />
            </Demo>
          </Reveal>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {more.map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} delay={(i % 3) * 100}>
              <article
                className={`${card} group flex h-full gap-4 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(3,42,31,0.12)] sm:p-6`}
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#ecf8f2] text-[#006b4b] transition-colors duration-300 group-hover:bg-[#006b4b] group-hover:text-[#a9d63a]">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-brand text-lg font-extrabold text-[#032a1f]">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#3f524b]">{text}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
