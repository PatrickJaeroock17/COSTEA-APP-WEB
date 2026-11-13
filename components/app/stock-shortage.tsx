"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { type ShortageRow, stockQty } from "@/lib/stock";

/**
 * Faltantes de stock como tabla compacta (DESIGN.md: aviso con fondo y borde suaves del color de error,
 * texto en tinta; el rojo solo en el icono). Ordenados por faltante; más de 5 filas se pliegan.
 */
export function StockShortage({ title, rows }: { title: string; rows: ShortageRow[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, 5);
  const rest = rows.length - shown.length;
  return (
    <div role="alert" className="rounded-2xl border border-danger/25 bg-danger-soft/60 p-4 text-sm text-ink">
      <p className="flex items-start gap-2 font-bold text-heading">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
        {title}
      </p>
      <div className="mt-3 overflow-x-auto rounded-xl bg-white">
        <table className="w-full min-w-[420px]">
          <thead>
            <tr className="border-b border-line text-left text-xs font-extrabold tracking-[0.06em] text-muted-foreground uppercase">
              <th className="px-3 py-2">Insumo</th>
              <th className="px-3 py-2 text-right">Necesitas</th>
              <th className="px-3 py-2 text-right">Hay</th>
              <th className="px-3 py-2 text-right">Te faltan</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {shown.map((r) => (
              <tr key={r.name} className="border-b border-line-soft last:border-0">
                <td className="px-3 py-2 font-semibold">{r.name}</td>
                <td className="px-3 py-2 text-right">{stockQty(r.needed, r.unit)}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{stockQty(r.available, r.unit)}</td>
                <td className="px-3 py-2 text-right font-extrabold text-heading">{stockQty(r.missing, r.unit, { ceil: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rest > 0 && (
        <button type="button" onClick={() => setAll(true)} className={buttonVariants({ variant: "link", className: "mt-2" })}>
          Ver los {rest} restantes
        </button>
      )}
      <p className="mt-3 text-ink-soft">
        Registra las entradas faltantes en{" "}
        <Link href="/app/inventario" className="font-bold text-primary hover:underline">
          Inventario
        </Link>
        .
      </p>
    </div>
  );
}
