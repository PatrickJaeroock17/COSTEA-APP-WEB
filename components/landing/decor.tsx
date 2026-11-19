import { cn } from "@/lib/utils";

/**
 * Fondos decorativos de la landing y el acceso (DESIGN.md §13). Todos `aria-hidden`, sin eventos de puntero
 * y hechos con degradados radiales (sin `filter: blur`, que es caro de pintar).
 */

const blob = "absolute rounded-full";

/** Aurora: manchas verdes y lima difusas. `tone="light"` sobre surface-page; `tone="dark"` sobre brand-900. */
export function Aurora({ tone = "light", drift = false, className }: { tone?: "light" | "dark"; drift?: boolean; className?: string }) {
  const dark = tone === "dark";
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      <div
        className={cn(
          blob,
          drift && "aurora-drift-a",
          "-left-[12%] -top-[18%] size-[min(46rem,110vw)]",
          dark
            ? "bg-[radial-gradient(closest-side,var(--color-brand-500),transparent)] opacity-45"
            : "bg-[radial-gradient(closest-side,var(--color-brand-200),transparent)] opacity-70",
        )}
      />
      <div
        className={cn(
          blob,
          drift && "aurora-drift-b",
          "-right-[10%] top-[8%] size-[min(38rem,95vw)]",
          dark
            ? "bg-[radial-gradient(closest-side,var(--color-lime-500),transparent)] opacity-20"
            : "bg-[radial-gradient(closest-side,var(--color-lime-300),transparent)] opacity-50",
        )}
      />
      <div
        className={cn(
          blob,
          drift && "aurora-drift-c",
          "-bottom-[30%] left-[28%] size-[min(42rem,100vw)]",
          dark
            ? "bg-[radial-gradient(closest-side,var(--color-brand-600),transparent)] opacity-50"
            : "bg-[radial-gradient(closest-side,var(--color-brand-100),transparent)] opacity-90",
        )}
      />
    </div>
  );
}

/** Patrón de puntos muy tenue que se desvanece hacia los bordes. */
export function DotGrid({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("dot-grid fade-radial pointer-events-none absolute inset-0", tone === "dark" ? "text-white/10" : "text-brand-900/10", className)}
    />
  );
}
