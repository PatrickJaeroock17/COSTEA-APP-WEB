"use client";

import Link from "next/link";
import { useActionState, useDeferredValue, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Loader2, Plus, Search } from "lucide-react";
import { FormAlert } from "@/components/app/form";
import { addCatalogMaterial, type MaterialState } from "@/lib/actions/materials";
import { inputClass } from "@/components/auth/fields";
import { cn } from "@/lib/utils";

export type CatalogRow = {
  id: number;
  code: string;
  name: string;
  category: string;
  unit: string;
  price: string;
  active: boolean;
  /** Id del insumo del restaurante si ya se agregó. */
  mine: number | null;
};

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#ecf8f2] px-3.5 text-sm font-bold text-[#006b4b] transition-colors hover:bg-[#d2efe1] disabled:opacity-60"
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
      Agregar
    </button>
  );
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function CatalogList({ rows, canAdd, blockedReason }: { rows: CatalogRow[]; canAdd: boolean; blockedReason?: string }) {
  const [state, action] = useActionState<MaterialState, FormData>(addCatalogMaterial, {});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const q = useDeferredValue(query);
  const categories = useMemo(() => [...new Set(rows.map((r) => r.category))].sort((a, b) => a.localeCompare(b, "es")), [rows]);
  const shown = useMemo(() => {
    const needle = fold(q.trim());
    return rows.filter((r) => (!category || r.category === category) && (!needle || fold(`${r.code} ${r.name} ${r.category}`).includes(needle)));
  }, [rows, q, category]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar en el catálogo</span>
          <Search className="pointer-events-none absolute left-4 top-[30px] size-4 -translate-y-1/2 text-[#5b6b65]" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, código o categoría" className={cn(inputClass, "pl-11")} />
        </label>
        <label className="sm:w-72">
          <span className="sr-only">Categoría</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      {blockedReason && <p className="mt-4 rounded-xl bg-[#fff6e5] px-4 py-3 text-sm text-[#7a4b00]">{blockedReason}</p>}
      {state.error && (
        <div className="mt-4">
          <FormAlert error={state.error} />
        </div>
      )}
      <p className="mt-4 text-sm text-[#5b6b65]" aria-live="polite">
        {shown.length} de {rows.length} insumos · precios mayoristas referenciales sin IGV
      </p>
      <ul className="mt-3 divide-y divide-[#e2e9e5] rounded-2xl border border-[#e2e9e5] bg-white">
        {shown.slice(0, 200).map((r) => (
          <li key={r.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3", !r.active && "opacity-60")}>
            <span className="w-[72px] shrink-0 font-mono text-xs font-bold text-[#5b6b65]">{r.code}</span>
            <span className="min-w-0 flex-1 basis-48">
              <span className="block font-bold text-[#032a1f]">{r.name}</span>
              <span className="block text-xs text-[#5b6b65]">{r.category}</span>
            </span>
            <span className="w-32 text-right text-sm tabular-nums text-[#12251f]">
              {r.price} <span className="text-[#5b6b65]">/ {r.unit}</span>
            </span>
            <span className="flex w-32 justify-end">
              {r.mine ? (
                <Link href={`/app/insumos/${r.mine}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-[#006b4b] hover:bg-[#f6f9f7]">
                  <Check className="size-4" aria-hidden />
                  En mis insumos
                </Link>
              ) : !r.active ? (
                <span className="text-xs text-[#5b6b65]">Inactivo</span>
              ) : canAdd ? (
                <form action={action}>
                  <input type="hidden" name="catalogId" value={r.id} />
                  <AddButton />
                </form>
              ) : null}
            </span>
          </li>
        ))}
        {!shown.length && <li className="px-4 py-8 text-center text-sm text-[#5b6b65]">Ningún insumo coincide con la búsqueda.</li>}
      </ul>
      {shown.length > 200 && <p className="mt-3 text-sm text-[#5b6b65]">Se muestran los primeros 200. Afina la búsqueda para ver el resto.</p>}
    </div>
  );
}
