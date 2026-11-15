import { Boxes, Calculator, CalendarClock, ChefHat, FileCheck2, Package, Receipt, ShoppingCart, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DotGrid } from "@/components/landing/decor";
import { KardexDemo, PriceDemo, RecipeDemo } from "@/components/landing/feature-demos";
import { BudgetVisual, DarkChecks, ExpensesVisual, LaborVisual, PlanVisual, PriceVersionsVisual, SalesVisual } from "@/components/landing/micro-visuals";
import { SectionHeading } from "@/components/landing/section-heading";
import { card, cardDark, container, iconBadge, iconBadgeLime, panel, section } from "@/components/landing/styles";
import { InView } from "@/components/motion/in-view";
import { Reveal, Stagger } from "@/components/motion/reveal";
import { BorderBeam } from "@/components/ui/border-beam";
import { cn } from "@/lib/utils";

const h3 = "font-brand text-xl font-extrabold";
const copy = "mt-1.5 text-sm leading-relaxed";

/** Tarjeta grande con una demo en vivo. */
function Demo({ icon: Icon, title, text, className, children }: { icon: LucideIcon; title: string; text: string; className?: string; children: React.ReactNode }) {
  return (
    <article className={cn(card, "flex flex-col p-5 sm:p-6", className)}>
      <div className="flex items-start gap-4">
        <span className={iconBadge}>
          <Icon aria-hidden />
        </span>
        <div>
          <h3 className={cn(h3, "text-heading")}>{title}</h3>
          <p className={cn(copy, "text-ink-soft")}>{text}</p>
        </div>
      </div>
      <div className={cn(panel, "mt-5 flex-1 p-4")}>{children}</div>
    </article>
  );
}

/** Tarjeta chica: icono, texto y un micro-visual propio abajo. Informativa, sin hover. */
function Tile({ icon: Icon, title, text, className, children }: { icon: LucideIcon; title: string; text: string; className?: string; children: React.ReactNode }) {
  return (
    <article className={cn(card, "flex flex-col gap-4 p-5", className)}>
      <div>
        <span className={iconBadge}>
          <Icon aria-hidden />
        </span>
        <h3 className="mt-4 font-brand text-lg font-extrabold text-heading">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">{text}</p>
      </div>
      <div className="mt-auto">{children}</div>
    </article>
  );
}

export function Features() {
  return (
    <section id="incluye" className={section}>
      <DotGrid className="h-128" />
      <div className={cn(container, "relative")}>
        <Reveal>
          <SectionHeading
            eyebrow="Todo en un solo lugar"
            title="Qué"
            accent="incluye"
            text="Desde el kilo de pescado hasta el precio de la carta. Prueba las demos: son los mismos cálculos que usa el sistema."
          />
        </Reveal>

        {/* Bento de 12 columnas: tamaños distintos, una tarjeta oscura que rompe la uniformidad. */}
        <Stagger className="mt-8 grid gap-3 md:grid-cols-6 lg:grid-cols-12">
          <Demo
            icon={ChefHat}
            title="Platos y recetas"
            text="Arma cada plato con sus ingredientes. Si cambia un precio, el costo se recalcula."
            className="md:col-span-6 lg:col-span-7"
          >
            <RecipeDemo />
          </Demo>

          {/* Destacada: verde oscuro con acento lima y haz de luz en el borde */}
          <InView className={cn(cardDark, "flex flex-col p-5 sm:p-6 md:col-span-6 lg:col-span-5")}>
            <DotGrid tone="dark" />
            <div className="relative flex items-start gap-4">
              <span className={iconBadgeLime}>
                <Calculator aria-hidden />
              </span>
              <div>
                <h3 className={cn(h3, "text-white")}>Costo y precio por plato</h3>
                <p className={cn(copy, "text-sidebar-foreground")}>Elige el margen y obtén el precio sugerido con IGV, con la fórmula del sistema.</p>
              </div>
            </div>
            <div className="relative mt-5 flex-1 rounded-2xl bg-white p-4 text-foreground shadow-lift">
              <PriceDemo />
            </div>
            <div className="relative mt-4">
              <DarkChecks items={["Margen", "IGV 18 %", "Utilidad"]} />
            </div>
            <BorderBeam />
          </InView>

          <Demo
            icon={Boxes}
            title="Inventario"
            text="Kardex con costo promedio ponderado: cada compra actualiza el costo de tus insumos."
            className="md:col-span-6"
          >
            <KardexDemo />
          </Demo>

          <Tile icon={Package} title="Insumos y precios" text="Tu catálogo con versiones de precio, para saber cuánto costaba cada cosa en cada momento." className="md:col-span-3">
            <PriceVersionsVisual />
          </Tile>
          <Tile icon={Users} title="Personal" text="Registra tu planilla y calcula el costo de la mano de obra directa e indirecta." className="md:col-span-3">
            <LaborVisual />
          </Tile>
          <Tile icon={Receipt} title="Gastos" text="Costos indirectos, gastos de administración y de ventas en un solo lugar." className="md:col-span-3">
            <ExpensesVisual />
          </Tile>
          <Tile icon={CalendarClock} title="Plan de producción" text="Planea cuántos platos preparar y cuánto necesitarás de cada insumo." className="md:col-span-3">
            <PlanVisual />
          </Tile>

          <Tile icon={FileCheck2} title="Presupuestos" text="Presupuestos mensuales que, al publicarse, quedan fijos para compararlos con lo real." className="md:col-span-3">
            <BudgetVisual />
          </Tile>
          <Tile icon={ShoppingCart} title="Ventas" text="Registra lo vendido y mira ingresos, costos y utilidad del mes." className="md:col-span-3">
            <SalesVisual />
          </Tile>
        </Stagger>
      </div>
    </section>
  );
}
