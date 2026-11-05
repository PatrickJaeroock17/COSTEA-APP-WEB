import Link from "next/link";
import { MousePointer2 } from "lucide-react";
import { ChefScrub } from "@/components/landing/chef-scrub";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col overflow-hidden bg-cream md:block">
      {/* Chef: a la derecha en escritorio; debajo del texto en celular */}
      <ChefScrub className="order-2 aspect-video w-full md:absolute md:inset-y-0 md:right-0 md:aspect-auto md:w-[64%]" />

      {/* Tarjetas flotantes (valores de ejemplo) */}
      <div className="pointer-events-none absolute right-[6%] top-[34%] z-10 hidden rounded-2xl bg-white px-4 py-3 shadow-lg shadow-brand-900/10 md:block">
        <p className="text-[11px] text-muted">Costo completo (ejemplo)</p>
        <p className="font-brand text-xl font-bold text-brand-900">S/ 10.00</p>
      </div>
      <div className="pointer-events-none absolute bottom-[22%] right-[38%] z-10 hidden rounded-2xl bg-brand-600 px-4 py-3 text-white shadow-lg shadow-brand-900/20 md:block">
        <p className="text-[11px] opacity-90">Margen (ejemplo)</p>
        <p className="font-brand text-xl font-bold">33 %</p>
      </div>

      <div className="relative z-10 order-1 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-5 pb-10 pt-28 sm:px-8 md:min-h-screen md:pb-24 md:pt-24">
        <div className="max-w-xl">
          <span className="inline-block rounded-full bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-brand-700">
            Costos y presupuestos para restaurantes
          </span>
          <h1 className="mt-5 font-brand text-4xl font-extrabold leading-[1.08] tracking-tight text-brand-900 sm:text-5xl lg:text-6xl">
            Sabe cuánto cuesta cada plato y cuánto te deja.
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted sm:text-lg">
            Costea reúne tus insumos, recetas, personal y gastos para calcular el costo real de tu carta, fijar precios
            con margen y planear cada mes con números claros.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/registro"
              className={cn(buttonVariants(), "h-12 rounded-xl bg-brand-600 px-6 text-base font-semibold hover:bg-brand-700")}
            >
              Crear mi cuenta
            </Link>
            <a
              href="#como-funciona"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-12 rounded-xl border-brand-600/30 bg-white/70 px-6 text-base font-semibold text-brand-700 hover:bg-white",
              )}
            >
              Ver cómo funciona
            </a>
          </div>
          <p className="mt-5 text-xs text-muted">Hecho para restaurantes en Perú · Precios con IGV del 18 %</p>
        </div>
        <p className="mt-10 hidden items-center gap-1.5 text-xs text-muted md:flex">
          <MousePointer2 className="size-3.5" aria-hidden /> Mueve el cursor: el chef te sigue.
        </p>
      </div>
    </section>
  );
}
