import { Boxes, Calculator, CalendarClock, ChefHat, FileCheck2, Package, Receipt, ShoppingCart, Users } from "lucide-react";

const features = [
  { icon: Package, title: "Insumos y precios", text: "Tu catálogo de insumos con versiones de precio, para saber cuánto costaba cada cosa en cada momento." },
  { icon: ChefHat, title: "Platos y recetas", text: "Arma cada plato con sus ingredientes y cantidades. Las recetas guardan versiones." },
  { icon: Users, title: "Personal", text: "Registra tu planilla y calcula el costo de la mano de obra directa e indirecta." },
  { icon: Receipt, title: "Gastos", text: "Costos indirectos de fabricación, gastos de administración y de ventas en un solo lugar." },
  { icon: Calculator, title: "Costo y precio por plato", text: "Costo completo de cada plato y precio sugerido según el margen que quieres ganar." },
  { icon: CalendarClock, title: "Plan de producción", text: "Planea cuántos platos preparar y cuánto necesitarás de cada insumo." },
  { icon: FileCheck2, title: "Presupuestos", text: "Presupuestos mensuales que, una vez publicados, quedan fijos para comparar con lo real." },
  { icon: ShoppingCart, title: "Ventas", text: "Registra lo vendido y mira ingresos, costos y utilidad del mes." },
  { icon: Boxes, title: "Inventario", text: "Kardex con costo promedio ponderado: entradas, salidas y saldo de cada insumo." },
];

export function Features() {
  return (
    <section id="incluye" className="scroll-mt-4 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <h2 className="font-brand text-3xl font-extrabold tracking-tight text-brand-900 sm:text-4xl">Qué incluye</h2>
        <p className="mt-3 max-w-2xl text-brand-700">Todo lo que necesitas para costear tu restaurante, en un mismo sistema.</p>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-[var(--radius-card)] border border-line bg-surface p-6 transition-shadow hover:shadow-md hover:shadow-brand-900/5">
              <span className="grid size-11 place-items-center rounded-xl bg-brand-100 text-brand-600">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-semibold text-brand-900">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-brand-700">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

