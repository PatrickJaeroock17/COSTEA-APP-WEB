import { cn } from "@/lib/utils";

/** Encabezado de sección de la landing (DESIGN.md §2): píldora, H2 y texto opcional. `tone="dark"` sobre brand-900. */
export function SectionHeading({
  eyebrow,
  title,
  text,
  tone = "light",
  className,
  textClassName,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  tone?: "light" | "dark";
  className?: string;
  textClassName?: string;
}) {
  const dark = tone === "dark";
  return (
    <div className={className}>
      <span className={cn("inline-block rounded-full px-3.5 py-1.75 text-small font-bold", dark ? "bg-white/10 text-lime-300" : "bg-white/70 text-brand-700")}>
        {eyebrow}
      </span>
      <h2 className={cn("mt-4 font-brand text-4xl leading-display font-extrabold tracking-display sm:text-5xl", dark ? "text-white" : "text-heading")}>{title}</h2>
      {text && <p className={cn("mt-4 max-w-2xl text-lg leading-relaxed", dark ? "text-sidebar-foreground" : "text-ink-soft", textClassName)}>{text}</p>}
    </div>
  );
}
