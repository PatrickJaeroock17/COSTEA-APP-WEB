import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { container } from "@/components/landing/styles";
import { cn, focusRing } from "@/lib/utils";

const link = cn("inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-ink transition-colors hover:text-primary md:min-h-0", focusRing);

/** Iconos de redes: trazos propios (Lucide ya no trae logos de marcas). */
const socials: { label: string; icon: React.ReactNode }[] = [
  {
    label: "Instagram",
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <path d="M17.5 6.5h.01" />
      </>
    ),
  },
  { label: "Facebook", icon: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /> },
  { label: "TikTok", icon: <path d="M9 12a4 4 0 1 0 4 4V3a5 5 0 0 0 5 5" /> },
  {
    label: "LinkedIn",
    icon: (
      <>
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
        <path d="M2 9h4v12H2z" />
        <circle cx="4" cy="4" r="2" />
      </>
    ),
  },
];

type Item = { label: string; href: string };
const columns: { title: string; links: Item[] }[] = [
  {
    title: "Producto",
    links: [
      { label: "Qué incluye", href: "#incluye" },
      { label: "Cómo funciona", href: "#como-funciona" },
      { label: "Planes", href: "#planes" },
      { label: "Preguntas", href: "#preguntas" },
    ],
  },
  {
    title: "Cuenta",
    links: [
      { label: "Iniciar sesión", href: "/ingresar" },
      { label: "Crear cuenta", href: "/registro" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { label: "Contacto", href: "#" },
      { label: "Soporte", href: "#" },
    ],
  },
];
const legal = ["Privacidad", "Términos", "Contacto"];

function FooterLink({ label, href, className }: Item & { className?: string }) {
  // Las rutas de la app van con <Link>; las anclas y los "#" provisionales, con <a>.
  return href.startsWith("/") ? (
    <Link href={href} className={className}>{label}</Link>
  ) : (
    <a href={href} className={className}>{label}</a>
  );
}

/** Año del copyright. Con Cache Components la hora actual no puede leerse al prerenderizar: se cachea. */
async function Year() {
  "use cache";
  return <>{new Date().getFullYear()}</>;
}

export function SiteFooter() {
  return (
    <footer className="pt-6">
      <div className={container}>
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
          <div className="sm:col-span-2 lg:col-span-1">
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">Costos y presupuestos para restaurantes en Perú.</p>
            <ul className="mt-5 flex gap-2">
              {socials.map((s) => (
                <li key={s.label}>
                  <a
                    href="#"
                    aria-label={s.label}
                    className={cn(
                      "grid size-11 place-items-center rounded-full border border-line bg-white text-ink-soft transition-colors hover:border-brand-200 hover:text-primary",
                      focusRing,
                    )}
                  >
                    <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      {s.icon}
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {columns.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <h2 className="text-small font-semibold text-muted-foreground">{c.title}</h2>
              <ul className="mt-2 md:mt-4 md:space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <FooterLink {...l} className={link} />
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Decorativa: la marca en grande, verde muy tenue, que se desvanece hacia abajo */}
        <p
          aria-hidden
          className="pointer-events-none mt-10 bg-linear-to-b from-brand-100 to-transparent bg-clip-text text-center font-brand text-[clamp(5.5rem,24vw,19rem)] leading-[0.82] font-extrabold tracking-display text-transparent select-none sm:mt-14"
        >
          costea
        </p>

        <div className="flex flex-col gap-2 border-t border-line py-5 text-small text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© <Year /> Costea. Todos los derechos reservados.</p>
          <nav aria-label="Legal" className="flex gap-5">
            {legal.map((l) => (
              <a key={l} href="#" className={cn("inline-flex min-h-11 items-center rounded-md transition-colors hover:text-primary sm:min-h-0", focusRing)}>
                {l}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
