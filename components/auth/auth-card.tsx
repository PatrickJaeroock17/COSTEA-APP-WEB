import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, MousePointer2 } from "lucide-react";
import { ChefScrub } from "@/components/landing/chef-scrub";

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
    // data-chef-area: el chef sigue al cursor en toda la pantalla
    <main data-chef-area className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4e6c9] p-3 sm:p-8">
      <Image src="/chef/f051.webp" alt="" fill priority sizes="100vw" className="scale-125 object-cover opacity-80 blur-2xl" />
      <div aria-hidden className="absolute inset-0 bg-[#f4e6c9]/35" />

      <div className="relative grid w-full max-w-[1040px] overflow-hidden rounded-[32px] bg-white p-2.5 shadow-[0_30px_80px_rgba(3,42,31,0.28)] sm:p-3 md:grid-cols-[1.05fr_1fr]">
        <div className="relative h-64 overflow-hidden rounded-[24px] bg-[#e9d4ad] sm:h-80 md:h-auto md:min-h-[620px]">
          <ChefScrub className="absolute inset-0 [&_img]:object-[50%_15%]" center={0.33} posX={0.46} fade={false} desktopOnly />
          <div aria-hidden className="absolute inset-0 bg-linear-to-t from-[#032a1f]/85 via-[#032a1f]/10 to-transparent" />
          <Link
            href="/"
            className="absolute left-4 top-4 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/80 px-3.5 text-sm font-bold text-[#032a1f] backdrop-blur transition-colors hover:bg-white"
          >
            <ArrowLeft className="size-4" aria-hidden /> Inicio
          </Link>
          <div className="absolute inset-x-5 bottom-4 sm:inset-x-8 sm:bottom-8">
            <p className="font-brand text-[26px] font-extrabold uppercase leading-[0.95] tracking-[-0.02em] text-white md:text-[clamp(34px,4.4vw,54px)]">
              {tagline.map((l) => (
                <span key={l} className="mr-2 inline md:mr-0 md:block">{l}</span>
              ))}
            </p>
            <p className="mt-3 hidden items-center gap-1.5 text-[13px] font-semibold text-white/80 md:flex">
              <MousePointer2 className="size-4" aria-hidden /> Mueve el cursor: el chef te mira.
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-center px-4 py-8 sm:px-10 md:px-12 lg:px-14">
          <div className="mx-auto w-full max-w-[380px]">
            <div className="flex flex-col items-center text-center">
              <Image src="/brand/costea-symbol.svg" alt="" width={44} height={44} />
              <span className="mt-1 font-brand text-lg font-extrabold text-[#006b4b]">costea</span>
              <h1 className="mt-5 font-brand text-[28px] font-extrabold uppercase leading-tight tracking-[-0.01em] text-[#032a1f] sm:text-[32px]">
                {title}
              </h1>
              <p className="mt-2 text-[15px] leading-snug text-[#5b6b65]">{sub}</p>
            </div>
            <div className="mt-8">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}