import { Hammer } from "lucide-react";
import { ALL_ITEMS } from "@/lib/nav";

/** Pantalla provisional de un módulo que aún no se construye. */
export function ModulePlaceholder({ href }: { href: string }) {
  const item = ALL_ITEMS.find((i) => i.href === href)!;
  const Icon = item.icon;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-brand-600 text-lime-500">
          <Icon className="size-6" aria-hidden />
        </span>
        <h1 className="font-brand text-3xl font-extrabold tracking-[-0.02em] text-heading sm:text-4xl">{item.label}</h1>
      </div>
      <p className="mt-4 text-lg text-ink-soft">{item.desc}</p>
      <div className="mt-8 flex items-start gap-4 rounded-[24px] border border-dashed border-brand-600/30 bg-white p-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
          <Hammer className="size-5" aria-hidden />
        </span>
        <div>
          <p className="font-bold text-heading">Este módulo se construye en la {item.phase}.</p>
          <p className="mt-1 text-sm text-muted-foreground">Mientras tanto, ya puedes configurar tu restaurante, sus meses de trabajo y sus unidades en Configuración.</p>
        </div>
      </div>
    </div>
  );
}
