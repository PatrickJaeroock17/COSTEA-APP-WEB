import Link from "next/link";
import { MousePointer2 } from "lucide-react";
import { ChefScrub } from "@/components/landing/chef-scrub";

export function Hero() {
  return (
    // Móvil: la sección es más alta que la pantalla y la escena queda anclada (sticky) mientras el scroll gira al chef.
    <section className="relative h-[190svh] w-full overflow-clip bg-[#f4e6c9] md:h-auto md:overflow-hidden">
      <div className="sticky top-0 h-svh md:static md:h-auto md:min-h-[max(100vh,780px)]">
        {/* Chef: detrás de todo */}
        <ChefScrub className="absolute inset-0 md:left-auto md:w-[78%]" />

        {/* Tarjetas flotantes (valores de ejemplo) */}
        <div className="hero-bob pointer-events-none absolute right-[6%] top-[30%] z-[2] hidden rounded-2xl bg-white px-4 py-3 shadow-[0_12px_30px_rgba(3,42,31,0.18)] [--bob-dur:5s] md:block">
          <p className="text-xs font-semibold text-[#5b6b65]">Costo completo (ejemplo)</p>
          <p className="font-brand text-2xl font-extrabold text-[#032a1f]">S/ 10.00</p>
        </div>
        <div className="hero-bob pointer-events-none absolute bottom-[16%] left-[49%] z-[2] hidden rounded-2xl bg-[#006b4b] px-4 py-3 shadow-[0_12px_30px_rgba(3,42,31,0.25)] [--bob-delay:0.6s] [--bob-dur:5.8s] md:block">
          <p className="text-xs font-semibold text-[#d8ee9c]">Margen (ejemplo)</p>
          <p className="font-brand text-2xl font-extrabold text-white">33 %</p>
        </div>

        {/* Contenido: abajo sobre el chef en móvil; a la izquierda en escritorio */}
        <div className="absolute inset-x-0 bottom-0 z-[1] flex flex-col justify-end bg-linear-to-t from-[#f4e6c9] from-65% to-transparent px-5 pb-8 pt-28 sm:px-8 md:relative md:inset-auto md:min-h-[inherit] md:justify-center md:bg-none md:px-16 md:pb-16 md:pt-28">
          <div className="flex max-w-[540px] flex-col items-start gap-4 md:gap-6">
            <span className="rounded-full bg-white/70 px-3.5 py-[7px] text-[13px] font-bold text-[#00563d]">
              Costos y presupuestos para restaurantes
            </span>
            <h1 className="font-brand text-[clamp(34px,4.6vw,62px)] font-extrabold leading-[1.04] tracking-[-0.025em] text-[#032a1f]">
              Sabe cuánto cuesta cada plato y cuánto te deja.
            </h1>
            <p className="hidden max-w-[500px] text-[19px] leading-[1.6] text-[#2c3f38] md:block">
              Costea reúne tus insumos, recetas, personal y gastos para calcular el costo real de tu carta, fijar
              precios con margen y planear cada mes con números claros.
            </p>
            <div className="flex flex-wrap gap-2 md:gap-3">
              <Link
                href="/registro"
                className="rounded-[14px] bg-[#006b4b] px-5 py-3.5 text-[15px] font-extrabold text-white transition-colors hover:bg-[#00563d] md:px-[26px] md:py-[15px] md:text-base"
              >
                Crear mi cuenta
              </Link>
              <a
                href="#como-funciona"
                className="rounded-[14px] border-[1.5px] border-[#006b4b] bg-white/60 px-5 py-3.5 text-[15px] font-extrabold text-[#006b4b] transition-colors hover:bg-white/80 md:px-[26px] md:py-[15px] md:text-base"
              >
                Ver cómo funciona
              </a>
            </div>
            <p className="hidden text-sm text-[#3f524b] md:block">
              Hecho para restaurantes en Perú · Precios con IGV del 18 %
            </p>
            <p className="flex items-center gap-1.5 text-[13px] text-[#3f524b] md:hidden">
              <MousePointer2 className="size-4" aria-hidden /> Desliza hacia abajo: el chef te sigue.
            </p>
          </div>
        </div>

        <p className="absolute bottom-[22px] left-16 z-[1] hidden items-center gap-1.5 text-[13px] text-[#3f524b] md:flex">
          <MousePointer2 className="size-4" aria-hidden /> Mueve el cursor: el chef te sigue.
        </p>
      </div>
    </section>
  );
}
