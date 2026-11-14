"use client";

import { AlertTriangle, Clock } from "lucide-react";
import { formatQty } from "@/lib/format";
import type { ReportChartsData } from "@/lib/report-charts";
import { cn } from "@/lib/utils";
import { money } from "./chart-kit";

/** Capacidad por trabajador: requerido frente a disponible (minutos, o porciones si su base directa es por porción). */
export default function CapacityChart({ data, currency }: { data: ReportChartsData["capacity"]; currency: string }) {
  const idle = Number(data.idle);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
      <ul className="grid content-start gap-4">
        {data.staff.map((s) => {
          const available = Number(s.available);
          const required = Number(s.required);
          const over = Number(s.excess) > 0;
          const ratio = available > 0 ? required / available : required > 0 ? 1 : 0;
          const unit = s.basis === "quantity" ? "porc." : "min";
          return (
            <li key={s.name} className="text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="font-semibold text-ink">{s.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  <strong className="text-heading">{formatQty(s.required, 2)}</strong> / {formatQty(s.available, 2)} {unit}
                </span>
              </div>
              <div
                className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-field"
                role="progressbar"
                aria-label={`Capacidad usada por ${s.name}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(Math.min(ratio, 1) * 100)}
              >
                <div className={cn("h-full rounded-full", over ? "bg-danger" : "bg-lime-500")} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
              </div>
              <p className={cn("mt-1 flex items-center gap-1 text-xs", over ? "font-semibold text-danger-text" : "text-muted-foreground")}>
                {over ? (
                  <>
                    <AlertTriangle className="size-3.5" aria-hidden />
                    Excede en {formatQty(s.excess, 2)} {unit}
                  </>
                ) : (
                  <>
                    {s.basis === "quantity" ? "Por porción" : "Por tiempo"} · {available > 0 ? `${(ratio * 100).toFixed(1)} % usado` : "sin capacidad registrada"} · no absorbida{" "}
                    {money(s.idle, currency)}
                  </>
                )}
              </p>
            </li>
          );
        })}
        {!data.staff.length && <li className="text-sm text-muted-foreground">Sin personal configurado en este mes.</li>}
      </ul>

      <div className="rounded-2xl border border-line bg-surface p-4">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Clock className="size-5" aria-hidden />
        </span>
        <p className="mt-3 text-xs font-semibold text-muted-foreground">MOD no absorbida del mes</p>
        <p className={cn("mt-0.5 font-brand text-3xl font-extrabold tabular-nums", idle > 0 ? "text-warning-text" : "text-heading")}>{money(data.idle, currency)}</p>
        <p className="mt-2 text-xs text-ink-soft">
          De {money(data.modAvailable, currency)} de MOD disponible, {money(data.modAssigned, currency)} se asignó a platos. Lo no absorbido es costo del periodo.
        </p>
      </div>
    </div>
  );
}
