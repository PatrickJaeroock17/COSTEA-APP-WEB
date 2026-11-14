// Geometría de ejes de los gráficos de Reportes (solo presentación; no toca importes).

/** Paso "redondo" (1, 2, 2.5, 5 × 10^k) para unos 4 intervalos. */
function niceStep(raw: number) {
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

/**
 * Dominio del eje de porcentajes: siempre incluye el 0, con holgura a cada lado con datos para que la
 * etiqueta del valor quepa fuera de la barra. `labelShare` = fracción del ancho del área de trazado que
 * ocupa una etiqueta (ancho de la etiqueta en px ÷ ancho del área en px). Devuelve también las marcas.
 */
export function zeroBasedDomain(values: number[], labelShare = 0.3): { domain: [number, number]; ticks: number[] } {
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 10;
  const sides = (min < 0 ? 1 : 0) + (max > 0 ? 1 : 0);
  const share = Math.min(Math.max(labelShare, 0.05), 0.4);
  let start = 0;
  let end = 0;
  let step = 1;
  // Total T tal que cada lado con datos reserve share × T: T = span ÷ (1 − lados × share). El redondeo a
  // marcas "redondas" agranda el total y puede achicar el otro lado, así que se amplía hasta que ambos quepan.
  for (let grow = 1; grow < 4; grow += 0.15) {
    const pad = ((share * span) / (1 - sides * share)) * grow;
    const lo = min < 0 ? min - pad : 0;
    const hi = max > 0 ? max + pad : 0;
    step = niceStep((hi - lo || 10) / 4);
    start = Math.floor(lo / step) * step;
    end = Math.max(Math.ceil(hi / step) * step, start + step);
    const total = end - start;
    const fitsLeft = min >= 0 || (min - start) / total >= share;
    const fitsRight = max <= 0 || (end - max) / total >= share;
    if (fitsLeft && fitsRight) break;
  }
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6 || 0);
  return { domain: [start, end], ticks };
}

/** Parte un nombre en líneas de hasta `max` caracteres por palabras, sin abreviar ni usar "…". */
export function wrapLabel(text: string, max = 18): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    // Una palabra más larga que la línea se corta con guion para no salirse del eje.
    let w = word;
    while (w.length > max) {
      if (line) {
        lines.push(line);
        line = "";
      }
      lines.push(`${w.slice(0, max - 1)}-`);
      w = w.slice(max - 1);
    }
    if (!line) line = w;
    else if (`${line} ${w}`.length <= max) line = `${line} ${w}`;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}
