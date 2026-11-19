import { cn } from "@/lib/utils";

const bone = "animate-pulse rounded-2xl bg-line motion-reduce:animate-none";

/** Esqueleto de carga de las rutas de /app: encabezado + tarjetas. Mismo radio y espaciado que las pantallas reales. */
export function PageSkeleton({ variant = "list" }: { variant?: "list" | "cards" | "kpis" }) {
  return (
    <div className="mx-auto max-w-6xl" aria-busy="true" aria-label="Cargando">
      <div className="flex items-center gap-4">
        <div className={cn(bone, "size-12 shrink-0")} />
        <div className="space-y-2">
          <div className={cn(bone, "h-7 w-56 max-w-full")} />
          <div className={cn(bone, "h-4 w-72 max-w-full")} />
        </div>
      </div>
      {variant === "kpis" && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-3xl bg-card motion-reduce:animate-none" />)}
        </div>
      )}
      {variant === "cards" && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-40 animate-pulse rounded-3xl bg-card motion-reduce:animate-none" />)}
        </div>
      )}
      <div className={cn("animate-pulse rounded-3xl bg-card motion-reduce:animate-none", variant === "list" ? "mt-6 h-96" : "mt-4 h-64")} />
    </div>
  );
}
