"use client";

// Tablero de gráficos de Reportes. Cada gráfico es su propio chunk (next/dynamic), así Recharts
// solo se descarga en esta página. Los datos llegan ya calculados desde el servidor.
import dynamic from "next/dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReportChartsData } from "@/lib/report-charts";
import { cn } from "@/lib/utils";

const skeleton = (h: string) =>
  function ChartSkeleton() {
    return <div className={cn("animate-pulse rounded-2xl bg-surface motion-reduce:animate-none", h)} aria-busy="true" aria-label="Cargando gráfico" />;
  };

const CostPerPortionChart = dynamic(() => import("./cost-per-portion-chart"), {
  ssr: false,
  loading: skeleton("h-64"),
});
const CostCompositionChart = dynamic(() => import("./cost-composition-chart"), {
  ssr: false,
  loading: skeleton("h-56"),
});
const MarginChart = dynamic(() => import("./margin-chart"), {
  ssr: false,
  loading: skeleton("h-64"),
});
const BudgetChart = dynamic(() => import("./budget-chart"), {
  ssr: false,
  loading: skeleton("h-60"),
});
const CapacityChart = dynamic(() => import("./capacity-chart"), {
  ssr: false,
  loading: skeleton("h-40"),
});

function ChartCard({ title, text, className, children }: { title: string; text?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <Card className={cn("min-w-0 break-inside-avoid", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {text && <CardDescription>{text}</CardDescription>}
      </CardHeader>
      <CardContent className="min-w-0">{children}</CardContent>
    </Card>
  );
}

export function ReportCharts({ data, periodLabel }: { data: ReportChartsData; periodLabel: string }) {
  const cur = data.currency;
  return (
    <div className="mt-6 grid gap-6 print:block print:space-y-6" data-report-charts>
      <ChartCard
        title="Costo por porción y precio neto"
        text="Capas del costo completo por porción; la marca oscura es el precio neto sin IGV. El espacio entre ambos es el margen."
      >
        {data.costPerPortion.length ? (
          <CostPerPortionChart data={data.costPerPortion} currency={cur} />
        ) : (
          <p className="text-sm text-muted-foreground">Aún no hay platos con costo calculado.</p>
        )}
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2 print:block print:space-y-6">
        <ChartCard title="Composición de los costos del periodo" text="Materiales, MOD asignada, CIF, gastos y MOD no absorbida suman los costos del periodo.">
          <CostCompositionChart parts={data.composition.parts} total={data.composition.total} currency={cur} />
        </ChartCard>
        <ChartCard title="Margen por plato" text="Resultado sobre la venta neta de cada porción.">
          <MarginChart data={data.margins} withoutPrice={data.withoutPrice} breakeven={data.breakeven} currency={cur} periodLabel={periodLabel} />
        </ChartCard>
      </div>

      {data.budget && (
        <ChartCard title="Real vs. presupuesto" text={`Ventas registradas de ${periodLabel} frente al presupuesto v${data.budget.version} publicado.`}>
          <BudgetChart data={data.budget} currency={cur} />
        </ChartCard>
      )}

      <ChartCard title="Capacidad del personal" text="Requerido por el plan frente a lo disponible de cada trabajador.">
        <CapacityChart data={data.capacity} currency={cur} />
      </ChartCard>
    </div>
  );
}
