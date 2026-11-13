import type { LucideIcon } from "lucide-react";

/** Encabezado de módulo: icono, título, texto y acciones a la derecha. */
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
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#006b4b] text-[#a9d63a]">
            <Icon className="size-6" aria-hidden />
          </span>
          <h1 className="font-brand text-3xl font-extrabold tracking-[-0.02em] text-[#032a1f] sm:text-4xl">{title}</h1>
        </div>
        {text && <p className="mt-3 max-w-2xl text-[#3f524b]">{text}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

/** Estado vacío con llamada a la acción. */
export function EmptyState({ title, text, children }: { title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-[24px] border border-dashed border-[#006b4b]/30 bg-white px-6 py-10 text-center">
      <p className="font-brand text-lg font-extrabold text-[#032a1f]">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-md text-sm text-[#5b6b65]">{text}</p>}
      {children && <div className="mt-5 flex justify-center gap-2">{children}</div>}
    </div>
  );
}
