import { Sparkles, type LucideIcon } from "lucide-react";

/** Encabezado de módulo: mosaico de icono, título, texto y acciones a la derecha (DESIGN.md §2 y §7). */
export function PageHeader({
  icon: Icon,
  title,
  text,
  children,
}: {
  icon: LucideIcon;
  title: string;
  text?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-600 text-lime-500">
            <Icon className="size-6" aria-hidden />
          </span>
          <h1 className="font-brand text-3xl font-extrabold tracking-[-0.02em] text-heading sm:text-4xl">{title}</h1>
        </div>
        {text && <p className="mt-3 max-w-2xl text-ink-soft">{text}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

/** Estado vacío con llamada a la acción. */
export function EmptyState({ title, text, icon: Icon = Sparkles, children }: { title: string; text?: string; icon?: LucideIcon; children?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-brand-600/30 bg-white px-6 py-12 text-center">
      <span className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-brand-100 text-brand-600">
        <Icon className="size-8" aria-hidden />
      </span>
      <p className="font-brand text-lg font-extrabold text-heading">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{text}</p>}
      {children && <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}
