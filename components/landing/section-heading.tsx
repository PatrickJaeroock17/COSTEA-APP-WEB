import { cn } from "@/lib/utils";

/**
 * Encabezado de sección de la landing (DESIGN.md §13): chip, H2 y texto opcional.
 * `accent` es la parte final del título y va en verde de marca: title="Qué" accent="incluye".
 */
export function SectionHeading({
  eyebrow,
  title,
  accent,
  text,
  className,
  textClassName,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  text?: string;
  className?: string;
  textClassName?: string;
}) {
  return (
    <div className={className}>
      <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-small font-bold text-brand-700">
        <i aria-hidden className="size-1.5 rounded-full bg-lime-500" />
        {eyebrow}
      </span>
      <h2 className="mt-3 font-brand text-4xl leading-display font-extrabold tracking-display text-heading sm:text-5xl lg:text-6xl">
        {title}
        {accent && <span className="text-primary"> {accent}</span>}
      </h2>
      {text && <p className={cn("mt-3 max-w-2xl text-lg leading-relaxed text-ink-soft", textClassName)}>{text}</p>}
    </div>
  );
}
