"use client";

import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import type { CostPortionDatum } from "@/lib/report-charts";
import { Legend, NAME_AXIS, NameTick, SERIES, axisMoney, datumTooltip, money, num, pctText, rowHeight, useChartAnimation } from "./chart-kit";

const KEYS = ["mp", "mo", "cif", "gastos"] as const;
const config = Object.fromEntries(KEYS.map((k) => [k, SERIES[k]])) satisfies ChartConfig;
const BAR = 22;

type Point = {
  name: string;
  mp: number;
  mo: number;
  cif: number;
  gastos: number;
  net: number | null;
  raw: CostPortionDatum;
};

/** Marca vertical del precio neto sobre la barra apilada. */
function PriceMark({ cx, cy }: { cx?: number; cy?: number }) {
  if (cx === undefined || cy === undefined || Number.isNaN(cx)) return null;
  const h = BAR / 2 + 5;
  return (
    <g>
      <line x1={cx} x2={cx} y1={cy - h} y2={cy + h} stroke="var(--card)" strokeWidth={6} strokeLinecap="round" />
      <line x1={cx} x2={cx} y1={cy - h} y2={cy + h} stroke="var(--foreground)" strokeWidth={2.5} strokeLinecap="round" />
    </g>
  );
}

export default function CostPerPortionChart({ data, currency }: { data: CostPortionDatum[]; currency: string }) {
  const animate = useChartAnimation();
  const points: Point[] = data.map((d) => ({
    name: d.name,
    mp: num(d.mp)!,
    mo: num(d.mo)!,
    cif: num(d.cif)!,
    gastos: num(d.gastos)!,
    net: num(d.net),
    raw: d,
  }));
  const tooltip = datumTooltip<Point>(({ raw }) => ({
    title: raw.name,
    rows: [
      ...KEYS.map((k) => ({
        label: SERIES[k].label,
        value: money(raw[k], currency),
        color: SERIES[k].color,
      })),
      {
        label: "Costo total / u",
        value: money(raw.complete, currency),
        strong: true,
      },
      { label: "Precio neto / u", value: money(raw.net, currency) },
      { label: "Margen", value: pctText(raw.margin) },
    ],
  }));

  return (
    <div>
      <Legend
        items={[
          ...KEYS.map((k) => SERIES[k]),
          {
            label: "Precio neto (sin IGV)",
            color: "var(--foreground)",
            mark: "line",
          },
        ]}
      />
      <ChartContainer
        config={config}
        className="mt-3 aspect-auto w-full"
        style={{
          height:
            points.length *
              rowHeight(
                data.map((d) => d.name),
                46,
              ) +
            40,
        }}
      >
        <ComposedChart data={points} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }} accessibilityLayer>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={axisMoney(currency)} />
          <YAxis type="category" dataKey="name" width={NAME_AXIS.width} tickLine={false} axisLine={false} tick={<NameTick />} interval={0} />
          <ChartTooltip cursor={{ fill: "var(--muted)" }} content={tooltip} />
          {KEYS.map((k, i) => (
            <Bar
              key={k}
              dataKey={k}
              name={SERIES[k].label}
              stackId="costo"
              barSize={BAR}
              fill={`var(--color-${k})`}
              stroke="var(--card)"
              strokeWidth={2}
              radius={i === 0 ? [4, 0, 0, 4] : i === KEYS.length - 1 ? [0, 4, 4, 0] : 0}
              isAnimationActive={animate}
              animationDuration={500}
            />
          ))}
          <Line dataKey="net" name="Precio neto" stroke="none" dot={<PriceMark />} activeDot={false} isAnimationActive={false} legendType="none" />
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}
