import Link from "next/link";
import { ArrowLeft, MousePointer2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ChefScrub } from "@/components/landing/chef-scrub";
import { DotGrid } from "@/components/landing/decor";
import { cn } from "@/lib/utils";

/** Foco del enlace que va sobre la foto: anillo blanco con separación oscura, visible sobre cualquier parte de la imagen. */
const focusOnPhoto = "outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-900";

/** Tarjeta flotante de acceso: el chef 3D a la izquierda (sigue al cursor) y el formulario a la derecha. */
export function AuthCard({
  tagline,
  title,
  sub,
  children,
}: {
  tagline: string[];
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    // data-chef-area: el chef sigue al cursor en toda la pantalla.
    // Fondo verde oscuro con degradado radial y puntos tenues; la tarjeta blanca va encima (DESIGN.md §13).
    <main data-chef-area className="surface-dark relative isolate flex min-h-screen items-center justify-center p-2.5 sm:p-8">
      <DotGrid tone="dark" className="-z-10" />
      <div className="grid w-full max-w-260 overflow-hidden rounded-5xl bg-card p-2.5 shadow-deep ring-1 ring-white/10 sm:p-3 md:grid-cols-[1.05fr_1fr]">
        <div className="relative h-40 overflow-hidden rounded-3xl bg-brand-800 sm:h-64 md:h-auto md:min-h-155">
          <ChefScrub className="absolute inset-0 [&_img]:object-[50%_26%] md:[&_img]:object-[50%_15%]" center={0.33} posX={0.46} fade={false} desktopOnly />
          <div aria-hidden className="absolute inset-0 bg-linear-to-t from-brand-900/85 via-brand-900/10 to-transparent" />
          <Link
            href="/"
            className={cn("absolute left-3 top-3 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/80 px-4 text-sm font-bold text-heading backdrop-blur transition-colors hover:bg-white sm:left-4 sm:top-4", focusOnPhoto)}
          >
            <ArrowLeft className="size-4" aria-hidden /> Inicio
          </Link>
          <div className="absolute inset-x-5 bottom-4 sm:inset-x-8 sm:bottom-8">
            <p className="font-brand text-2xl leading-[0.95] font-extrabold tracking-title text-white md:text-[clamp(34px,4.4vw,54px)]">
              {tagline.map((l) => (
                <span key={l} className="mr-2 inline md:mr-0 md:block">
                  {l}
                </span>
              ))}
            </p>
            <p className="mt-3 hidden items-center gap-1.5 text-small font-semibold text-white/80 md:flex">
              <MousePointer2 className="size-4" aria-hidden /> Mueve el cursor: el chef te mira.
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-center px-4 py-7 sm:px-10 sm:py-8 md:px-12 lg:px-14">
          <div className="mx-auto w-full max-w-95">
            <div className="flex flex-col items-center text-center">
              <Logo />
              <h1 className="mt-5 font-brand text-3xl leading-tight font-extrabold tracking-title text-heading sm:mt-6 sm:text-4xl">{title}</h1>
              <p className="mt-2 text-body leading-snug text-muted-foreground">{sub}</p>
            </div>
            <div className="mt-7 sm:mt-8">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
