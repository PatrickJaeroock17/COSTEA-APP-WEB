"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { D } from "@/lib/costing/decimal";
import { formatQty } from "@/lib/format";
import type { BudgetChart as BudgetData } from "@/lib/report-charts";
import { cn } from "@/lib/utils";
import { Legend, SERIES, axisMoney, datumTooltip, money, num, pctText, useChartAnimation } from "./chart-kit";

const config = {
  budget: SERIES.budget,
  real: SERIES.real,
} satisfies ChartConfig;

type Point = {
  concept: string;
  budget: number | null;
  real: number;
  raw: BudgetData["totals"][number];
};

export default function BudgetChart({ data, currency }: { data: BudgetData; currency: string }) {
  const animate = useChartAnimation();
  const points: Point[] = data.totals.map((t) => ({
    concept: t.concept,
    budget: num(t.budget),
    real: Number(t.actual),
    raw: t,
  }));
  const tooltip = datumTooltip<Point>(({ raw }) => ({
    title: raw.concept,
    rows: [
      {
        label: "Presupuesto",
        value: money(raw.budget, currency),
        color: SERIES.budget.color,
      },
      {
        label: "Real",
        value: money(raw.actual, currency),
        color: SERIES.real.color,
      },
      // Misma diferencia que la tabla: real − presupuesto.
      {
        label: "Diferencia",
        value: raw.budget ? money(new D(raw.actual).minus(raw.budget).toFixed(), currency) : "—",
        strong: true,
      },
    ],
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <Legend items={[SERIES.budget, SERIES.real]} />
        <ChartContainer config={config} className="mt-3 aspect-auto h-60 w-full">
          <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barGap={4} accessibilityLayer>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="concept" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} width={84} tickFormatter={axisMoney(currency)} />
            <ChartTooltip cursor={{ fill: "var(--muted)" }} content={tooltip} />
            <Bar dataKey="budget" name="Presupuesto" fill="var(--color-budget)" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={animate} animationDuration={500} />
            <Bar dataKey="real" name="Real" fill="var(--color-real)" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={animate} animationDuration={500} />
          </BarChart>
        </ChartContainer>
      </div>

      <div>
        <p className="text-sm font-bold text-heading">Avance de porciones vendidas</p>
        <ul className="mt-3 grid gap-3">
          {data.portions.map((p) => {
            const progress = num(p.progress);
            const width = progress === null ? 0 : Math.min(progress, 1) * 100;
            return (
              <li key={p.name} className="text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="min-w-0 font-semibold text-ink">{p.name}</span>
                  <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                    {formatQty(p.sold)} / {formatQty(p.planned)} · <strong className="text-heading">{pctText(p.progress)}</strong>
                  </span>
                </div>
                <div
                  className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-field"
                  role="progressbar"
                  aria-label={`Avance de ${p.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(width)}
                >
                  <div className={cn("h-full rounded-full", progress !== null && progress >= 1 ? "bg-brand-600" : "bg-lime-500")} style={{ width: `${width}%` }} />
                </div>
              </li>
            );
          })}
          {!data.portions.length && <li className="text-sm text-muted-foreground">El presupuesto no tiene platos.</li>}
        </ul>
      </div>
    </div>
  );
}
