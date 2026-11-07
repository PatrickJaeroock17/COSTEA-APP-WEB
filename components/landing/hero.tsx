import Link from "next/link";
import { ChevronDown, MousePointer2 } from "lucide-react";
import { ChefScrub } from "@/components/landing/chef-scrub";
import { SiteHeader } from "@/components/landing/site-header";

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
    <section
      style={{ ["--p" as string]: 0 }}
      className="relative h-[calc(100svh+1300px)] w-full overflow-clip bg-[#f4e6c9] md:h-auto md:overflow-hidden"
    >
      <div className="sticky top-0 h-svh overflow-hidden md:static md:h-auto md:min-h-[max(100vh,780px)] md:overflow-visible">
        {/* Chef: detrás de todo */}
        <ChefScrub className="absolute inset-x-0 top-12 h-[75svh] md:inset-y-0 md:top-0 md:left-auto md:h-auto md:w-[78%]" />

        {/* Degradado inferior (solo móvil) para que el texto se lea sobre el chef */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[340px] bg-[linear-gradient(to_top,#f4e6c9_0%,rgba(244,230,201,0.94)_40%,rgba(244,230,201,0)_100%)] md:hidden"
        />

        <SiteHeader />

        {/* Tarjetas flotantes (valores de ejemplo, solo escritorio) */}
        <div className="hero-bob pointer-events-none absolute right-[6%] top-[30%] z-[2] hidden rounded-2xl bg-white px-4 py-3 shadow-[0_12px_30px_rgba(3,42,31,0.18)] [--bob-dur:5s] md:block">
          <p className="text-xs font-semibold text-[#5b6b65]">Costo completo (ejemplo)</p>
          <p className="font-brand text-2xl font-extrabold text-[#032a1f]">S/ 10.00</p>
        </div>
        <div className="hero-bob pointer-events-none absolute bottom-[16%] left-[49%] z-[2] hidden rounded-2xl bg-[#006b4b] px-4 py-3 shadow-[0_12px_30px_rgba(3,42,31,0.25)] [--bob-delay:0.6s] [--bob-dur:5.8s] md:block">
          <p className="text-xs font-semibold text-[#d8ee9c]">Margen (ejemplo)</p>
          <p className="font-brand text-2xl font-extrabold text-white">33 %</p>
        </div>

        {/* Contenido */}
        <div className="absolute inset-x-0 bottom-0 z-[1] flex flex-col px-5 pb-5 md:relative md:inset-auto md:min-h-[inherit] md:justify-center md:px-16 md:pb-16 md:pt-28">
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
              <Link
                href="/registro"
                className="flex min-h-14 w-full items-center justify-between rounded-full bg-[#006b4b] pl-6 pr-2 text-base font-extrabold text-white transition-colors hover:bg-[#00563d] md:w-auto md:gap-6"
              >
                Crear mi cuenta
                <ArrowCircle />
              </Link>
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



