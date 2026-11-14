"use client";

import { Scale } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import type { Breakeven, MarginDatum } from "@/lib/report-charts";
import { zeroBasedDomain } from "@/lib/report-chart-axis";
import { NAME_AXIS, NameTick, datumTooltip, money, pctText, rowHeight, useChartAnimation } from "./chart-kit";

const config = {
  margin: { label: "Margen", color: "var(--chart-1)" },
} satisfies ChartConfig;

type Point = { name: string; margin: number; raw: MarginDatum };

const CHART_RIGHT = 12;
const pctLabel = (v: number) => `${v.toFixed(1).replace("-", "−")} %`;

/** Etiqueta del valor siempre fuera de la barra, hacia su extremo (derecha si es positivo, izquierda si es negativo). */
function ValueLabel({ x, y, width, height, value }: { x?: unknown; y?: unknown; width?: unknown; height?: unknown; value?: unknown }) {
  const [bx, by, bw, bh, v] = [x, y, width, height, value].map(Number);
  if ([bx, by, bw, bh, v].some(Number.isNaN)) return null;
  const left = Math.min(bx, bx + bw);
  const right = Math.max(bx, bx + bw);
  const negative = v < 0;
  return (
    <text
      x={negative ? left - 6 : right + 6}
      y={by + bh / 2}
      textAnchor={negative ? "end" : "start"}
      dominantBaseline="central"
      className={negative ? "fill-danger-text text-[11px] font-bold" : "fill-ink text-[11px] font-bold"}
    >
      {pctLabel(v)}
    </text>
  );
}

export default function MarginChart({
  data,
  withoutPrice,
  breakeven,
  currency,
  periodLabel,
}: {
  data: MarginDatum[];
  withoutPrice: number;
  breakeven: Breakeven;
  currency: string;
  periodLabel: string;
}) {
  const animate = useChartAnimation();
  const points: Point[] = data.map((d) => ({
    name: d.name,
    margin: Number(d.margin) * 100,
    raw: d,
  }));
  const tooltip = datumTooltip<Point>(({ raw }) => ({
    title: raw.name,
    rows: [
      {
        label: "Margen sobre venta neta",
        value: pctText(raw.margin),
        strong: false,
      },
      { label: "Precio neto / u", value: money(raw.net, currency) },
      { label: "Costo total / u", value: money(raw.complete, currency) },
      {
        label: "Resultado / u",
        value: money(raw.result, currency),
        strong: true,
      },
    ],
  }));
  // Ancho real del gráfico: la holgura del eje se calcula en píxeles para que la etiqueta quepa fuera de la barra.
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const plot = width - NAME_AXIS.width - CHART_RIGHT;
  const widest = Math.max(...points.map((p) => pctLabel(p.margin).length), 4);
  const { domain, ticks } = zeroBasedDomain(
    points.map((p) => p.margin),
    plot > 0 ? (widest * 6.6 + 10) / plot : 0.3,
  );
  const contributionKo = breakeven.ratio !== null && Number(breakeven.ratio) <= 0;

  return (
    <div className="grid gap-5">
      <div className="flex items-start gap-3 rounded-2xl bg-brand-50 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
          <Scale className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-secondary-foreground">Punto de equilibrio · ventas registradas de {periodLabel}</p>
          <p className="mt-0.5 font-brand text-2xl font-extrabold tabular-nums text-heading">
            {breakeven.equilibrium ? money(breakeven.equilibrium, currency) : "—"}
            {breakeven.equilibrium && <span className="ml-1.5 text-sm font-semibold text-muted-foreground">sin IGV</span>}
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {breakeven.equilibriumGross
              ? `${money(breakeven.equilibriumGross, currency)} con IGV · vendido ${money(breakeven.net, currency)} sin IGV · contribución ${pctText(breakeven.ratio)}`
              : contributionKo
                ? "El margen de contribución de las ventas registradas no cubre los costos variables."
                : "Aún no hay ventas registradas en el mes."}
          </p>
        </div>
      </div>

      {points.length ? (
        <div ref={box} className="min-w-0">
          <ChartContainer
            config={config}
            className="aspect-auto w-full"
            style={{ height: points.length * rowHeight(data.map((d) => d.name), 40) + 36 }}
          >
            <BarChart data={points} layout="vertical" margin={{ top: 4, right: CHART_RIGHT, bottom: 0, left: 0 }} baseValue={0} accessibilityLayer>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" tickLine={false} axisLine={false} domain={domain} ticks={ticks} allowDataOverflow tickFormatter={pctLabel} />
              <YAxis type="category" dataKey="name" width={NAME_AXIS.width} tickLine={false} axisLine={false} tick={<NameTick />} interval={0} />
              <ReferenceLine x={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
              <ChartTooltip cursor={{ fill: "var(--muted)" }} content={tooltip} />
              <Bar dataKey="margin" name="Margen" barSize={18} radius={4} isAnimationActive={animate} animationDuration={500}>
                {points.map((p) => (
                  <Cell key={p.name} fill={p.margin < 0 ? "var(--destructive)" : "var(--color-margin)"} />
                ))}
                <LabelList dataKey="margin" content={<ValueLabel />} />
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Aún no hay platos con precio para comparar márgenes.</p>
      )}
      {withoutPrice > 0 && points.length > 0 && (
        <p className="text-xs text-muted-foreground">{withoutPrice === 1 ? "1 plato sin precio no aparece." : `${withoutPrice} platos sin precio no aparecen.`}</p>
      )}
    </div>
  );
}
