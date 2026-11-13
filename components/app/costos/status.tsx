import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { PlanStatus } from "@/lib/costing/costing";
import { cn } from "@/lib/utils";

export const STATUS_LABEL: Record<PlanStatus, string> = {
  calculable: "Calculable",
  incompleto: "Faltan datos",
  sin_base_asignacion: "Gastos sin base de reparto",
  capacidad_excedida: "Capacidad excedida",
};

/** Estado del cálculo y pendientes (DESIGN.md: aviso con fondo suave y texto AA). */
export function PlanStatusBox({ status, issues }: { status: PlanStatus; issues: string[] }) {
  const ok = status === "calculable";
  return (
    <div className={cn("rounded-2xl px-4 py-3 text-sm", ok ? "bg-success-soft text-success-text" : "bg-warning-soft text-warning-text")} role={ok ? "status" : "alert"}>
      <p className="flex items-center gap-2 font-bold">
        {ok ? <CheckCircle2 className="size-4" aria-hidden /> : <AlertTriangle className="size-4" aria-hidden />}
        {ok ? "Cálculo completo: costos y precios listos para usar." : `${STATUS_LABEL[status]}: los totales son provisionales hasta resolver estos pendientes.`}
      </p>
      {!ok && issues.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-6">
          {issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
