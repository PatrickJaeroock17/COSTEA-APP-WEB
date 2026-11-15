import { ChevronDown, MousePointer2 } from "lucide-react";
import { ChefScrub } from "@/components/landing/chef-scrub";
import { Aurora } from "@/components/landing/decor";
import { container } from "@/components/landing/styles";
import { InView } from "@/components/motion/in-view";
import { Parallax } from "@/components/motion/parallax";
import { ShimmerLink } from "@/components/ui/shimmer-button";
import { cn } from "@/lib/utils";

// Altura de la caja del chef en móvil, como proporción del escenario. Bájala si la corbata queda tapada por el texto; súbela para ampliar al chef.
const CHEF_HEIGHT_RATIO = 0.74;

function ArrowCircle() {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#a9d63a]" aria-hidden>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#032a1f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17L17 7M8 7h9v9" />
      </svg>
    </span>
  );
}

export function Hero() {
  return (
    // Móvil: altura = pantalla + 1300 px de recorrido; el escenario queda anclado y el scroll gira al chef (HERO-MOVIL.md).
    // Escritorio: composición de HERO-REFERENCIA.md.
    // El crema vive solo dentro de un marco redondeado sobre el fondo de la página (DESIGN.md §13); la barra fija queda encima.
    <section
      style={{ ["--p" as string]: 0 }}
      className={cn(container, "relative h-[calc(100svh+1300px)] md:h-auto")}
    >
      {/* Aurora verde difusa detrás del marco: asoma por los lados y baja hacia la franja de cifras */}
      <Parallax className="absolute inset-x-[-12%] -top-nav -z-10 h-[min(100svh,56rem)] md:h-[130%]" distance={40}>
        <Aurora />
      </Parallax>
      <div className="sticky top-nav h-[calc(100svh-var(--spacing-nav)-0.5rem)] overflow-hidden rounded-3xl bg-cream-200 md:relative md:top-auto md:h-auto md:min-h-[clamp(620px,calc(100svh-var(--spacing-nav)-1rem),820px)]">
        {/* Malla verde tenue sobre el crema, del lado del texto */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(48%_60%_at_0%_0%,var(--color-brand-200),transparent_70%),radial-gradient(40%_50%_at_18%_100%,var(--color-lime-300),transparent_70%)] opacity-40 md:block"
        />

        {/* Chef: detrás de todo */}
        <ChefScrub
          className="absolute inset-x-0 top-0 h-[max(var(--chef-h),150vw)] md:inset-y-0 md:left-auto md:h-auto md:w-[78%]"
          style={{ ["--chef-h" as string]: `${CHEF_HEIGHT_RATIO * 100}%` }}
        />

        {/* Degradado inferior (solo móvil) para que el texto se lea sobre el chef */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[340px] bg-[linear-gradient(to_top,#f4e6c9_0%,rgba(244,230,201,0.94)_40%,rgba(244,230,201,0)_100%)] md:hidden"
        />

        {/* Tarjetas flotantes (valores de ejemplo, solo escritorio) */}
        <div className="hero-bob pointer-events-none absolute right-[6%] top-[30%] z-[2] hidden rounded-2xl bg-white px-4 py-3 shadow-[0_12px_30px_rgba(3,42,31,0.18)] [--bob-dur:5s] md:block">
          <p className="text-xs font-semibold text-[#5b6b65]">Costo completo (ejemplo)</p>
          <p className="font-brand text-2xl font-extrabold text-[#032a1f]">S/ 10.00</p>
        </div>
        <div className="hero-bob pointer-events-none absolute bottom-[16%] left-[49%] z-[2] hidden rounded-2xl bg-[#006b4b] px-4 py-3 shadow-[0_12px_30px_rgba(3,42,31,0.18)] [--bob-delay:0.6s] [--bob-dur:5.8s] md:block">
          <p className="text-xs font-semibold text-[#d8ee9c]">Margen (ejemplo)</p>
          <p className="font-brand text-2xl font-extrabold text-white">33 %</p>
        </div>

        {/* Más flotantes (valores de ejemplo, solo escritorio): el precio que sale del costo y margen de arriba, y la utilidad por plato */}
        <div className="hero-bob pointer-events-none absolute bottom-[21%] right-[4.5%] z-[2] hidden rounded-2xl bg-lime-500 px-4 py-3 shadow-float [--bob-delay:1.1s] [--bob-dur:6.4s] lg:block">
          <p className="text-xs font-semibold text-brand-800">Precio con IGV (ejemplo)</p>
          <p className="font-brand text-2xl font-extrabold text-brand-900">S/ 17.61</p>
        </div>
        <div className="hero-bob pointer-events-none absolute left-[46%] top-[13%] z-[2] hidden rounded-2xl border border-white/60 bg-white/85 px-3.5 py-3 shadow-float backdrop-blur-sm [--bob-delay:0.3s] [--bob-dur:6.8s] lg:block">
          <p className="text-xs font-semibold text-muted-foreground">Utilidad por plato (ejemplo)</p>
          <div aria-hidden className="mt-2 flex h-9 items-end gap-1.5">
            <i className="h-[45%] w-4 rounded-t-sm bg-brand-200" />
            <i className="h-[62%] w-4 rounded-t-sm bg-brand-300" />
            <i className="h-[78%] w-4 rounded-t-sm bg-primary" />
            <i className="h-full w-4 rounded-t-sm bg-lime-500" />
          </div>
        </div>

        {/* Contenido */}
        <div className="absolute inset-x-0 bottom-0 z-[1] flex flex-col px-5 pb-5 md:relative md:inset-auto md:min-h-[inherit] md:justify-center md:px-16 md:py-16">
          <div className="flex max-w-[540px] flex-col items-start gap-3 md:gap-6">
            <span className="hidden rounded-full bg-white/70 px-3.5 py-[7px] text-[13px] font-bold text-[#00563d] md:inline-block">
              Costos y presupuestos para restaurantes
            </span>
            <h1 className="font-brand text-[33px] font-extrabold leading-[1.06] tracking-[-0.025em] text-[#032a1f] md:text-[clamp(40px,4.6vw,62px)] md:leading-[1.04]">
              Deja de adivinar el precio de tus platos.
            </h1>
            <p className="text-sm leading-[1.4] text-[#2c3f38] md:max-w-[500px] md:text-[19px] md:leading-[1.6]">
              <span className="md:hidden">Costos, precios y margen en un solo lugar.</span>
              <span className="hidden md:inline">
                Costea reúne tus insumos, recetas, personal y gastos para calcular el costo real de tu carta, fijar
                precios con margen y planear cada mes con números claros.
              </span>
            </p>

            <div className="mt-1.5 flex w-full flex-wrap items-center gap-3 md:mt-0 md:w-auto">
              <InView className="w-full md:w-auto">
                <ShimmerLink href="/registro" className="w-full md:w-auto">
                  Crear mi cuenta
                  <ArrowCircle />
                </ShimmerLink>
              </InView>
              <a
                href="#como-funciona"
                className="hidden min-h-14 items-center rounded-full border-[1.5px] border-[#006b4b] bg-white/60 px-7 text-base font-extrabold text-[#006b4b] transition-colors hover:bg-white/80 md:inline-flex"
              >
                Ver cómo funciona
              </a>
            </div>

            <p className="hidden text-sm text-[#3f524b] md:block">
              Hecho para restaurantes en Perú · Precios con IGV del 18 %
            </p>

            {/* Aviso de scroll (solo móvil): desaparece al empezar a bajar */}
            <p
              className="flex items-center gap-1 self-center text-[13px] font-semibold text-[#032a1f] md:hidden"
              style={{ opacity: "max(0, calc(1 - var(--p) * 6))" }}
            >
              Baja y mira al chef <ChevronDown className="hero-chevron size-4" aria-hidden />
            </p>
          </div>
        </div>

        {/* Barra de progreso (solo móvil) */}
        <div aria-hidden className="absolute inset-x-5 bottom-2.5 z-[1] h-[3px] rounded-sm bg-[rgba(3,42,31,0.14)] md:hidden">
          <div className="h-full rounded-sm bg-[#006b4b]" style={{ width: "calc(var(--p) * 100%)" }} />
        </div>

        <p className="absolute bottom-[22px] left-16 z-[1] hidden items-center gap-1.5 text-[13px] text-[#3f524b] md:flex">
          <MousePointer2 className="size-4" aria-hidden /> Mueve el cursor: el chef te sigue.
        </p>
      </div>
    </section>
  );
}








