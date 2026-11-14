"use client";

import { Cell, Label, Pie, PieChart } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import type { CompositionPart } from "@/lib/report-charts";
import { SERIES, datumTooltip, money, num, pctText, useChartAnimation } from "./chart-kit";

type Slice = {
  key: CompositionPart["key"];
  label: string;
  value: number;
  raw: string;
};

export default function CostCompositionChart({ parts, total, currency }: { parts: CompositionPart[]; total: string; currency: string }) {
  const animate = useChartAnimation();
  const totalN = num(total)!;
  const share = (v: string) => (totalN ? Number(v) / totalN : null);
  const slices: Slice[] = parts
    .filter((p) => Number(p.value) > 0)
    .map((p) => ({
      key: p.key,
      label: p.label,
      value: Number(p.value),
      raw: p.value,
    }));
  const config = Object.fromEntries(parts.map((p) => [p.key, { label: p.label, color: SERIES[p.key].color }])) satisfies ChartConfig;
  const tooltip = datumTooltip<Slice>((s) => ({
    rows: [
      {
        label: s.label,
        value: money(s.raw, currency),
        color: SERIES[s.key].color,
      },
      { label: "Del total", value: pctText(share(s.raw)) },
    ],
  }));

  return (
    // Container query: la leyenda va al lado solo si el propio componente mide ≥ 700 px; si no, debajo.
    <div className="@container">
      <div className="grid items-center gap-5 @min-[700px]:grid-cols-[220px_1fr]">
        <ChartContainer config={config} className="mx-auto aspect-square w-full max-w-[220px]">
          <PieChart accessibilityLayer>
            <ChartTooltip content={tooltip} />
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius="64%"
              outerRadius="100%"
              stroke="var(--card)"
              strokeWidth={2}
              cornerRadius={4}
              isAnimationActive={animate}
              animationDuration={500}
            >
              {slices.map((s) => (
                <Cell key={s.key} fill={`var(--color-${s.key})`} />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (!viewBox || !("cx" in viewBox)) return null;
                  const { cx = 0, cy = 0 } = viewBox as {
                    cx?: number;
                    cy?: number;
                  };
                  return (
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan x={cx} y={cy - 10} className="fill-muted-foreground text-[11px] font-semibold">
                        Total del periodo
                      </tspan>
                      <tspan x={cx} y={cy + 10} className="fill-heading font-brand text-[15px] font-extrabold">
                        {money(total, currency)}
                      </tspan>
                    </text>
                  );
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
        <ul className="grid gap-2 text-sm">
          {parts.map((p) => (
            <li key={p.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-b border-line-soft pb-2 last:border-0 last:pb-0">
              <span className="flex items-center gap-2 text-ink-soft">
                <span className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: SERIES[p.key].color }} aria-hidden />
                {p.label}
              </span>
              <span className="ml-auto text-right whitespace-nowrap tabular-nums">
                <span className="font-bold text-heading">{money(p.value, currency)}</span>
                <span className="ml-2 text-xs text-muted-foreground">{pctText(share(p.value))}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
