import { describe, expect, it } from "vitest";
import { wrapLabel, zeroBasedDomain } from "@/lib/report-chart-axis";

describe("eje del margen por plato", () => {
  const check = (values: number[]) => {
    const { domain, ticks } = zeroBasedDomain(values);
    expect(domain[0]).toBeLessThanOrEqual(0);
    expect(domain[1]).toBeGreaterThanOrEqual(0);
    expect(ticks).toContain(0);
    expect(ticks[0]).toBe(domain[0]);
    expect(ticks.at(-1)).toBe(domain[1]);
    // Holgura para la etiqueta fuera de la barra.
    for (const v of values) {
      if (v < 0) expect(domain[0]).toBeLessThan(v);
      if (v > 0) expect(domain[1]).toBeGreaterThan(v);
    }
    return domain;
  };

  it("todos positivos: parte en 0", () => {
    expect(check([30, 42.5, 18])[0]).toBe(0);
  });

  it("mezcla de positivos y negativos", () => {
    check([25, -12, 40]);
  });

  it("todos negativos (−640 % y −549 %): termina en 0", () => {
    const domain = check([-640, -549]);
    expect(domain[1]).toBe(0);
    expect(domain[0]).toBeGreaterThanOrEqual(-1000);
  });

  it("sin variación", () => {
    check([0]);
  });

  it("en móvil la etiqueta de −640 % cabe a la izquierda de la barra", () => {
    // Área de trazado ~180 px y etiqueta ~56 px.
    const share = 56 / 180;
    const { domain } = zeroBasedDomain([-640, -549], share);
    const px = ((-640 - domain[0]) / (domain[1] - domain[0])) * 180;
    expect(px).toBeGreaterThanOrEqual(56);
  });

  it("mezcla en móvil: hay espacio a ambos lados", () => {
    const share = 56 / 180;
    const { domain } = zeroBasedDomain([-120, 35], share);
    const width = domain[1] - domain[0];
    expect(((-120 - domain[0]) / width) * 180).toBeGreaterThanOrEqual(56);
    expect(((domain[1] - 35) / width) * 180).toBeGreaterThanOrEqual(56);
  });
});

describe("nombres de plato en el eje", () => {
  it("no abrevia: reparte por palabras", () => {
    const lines = wrapLabel("Arroz con mariscos a la norteña", 18);
    expect(lines.join(" ")).toBe("Arroz con mariscos a la norteña");
    expect(lines.every((l) => l.length <= 18)).toBe(true);
    expect(lines.join("")).not.toContain("…");
  });

  it("nombre corto en una línea", () => {
    expect(wrapLabel("Ceviche")).toEqual(["Ceviche"]);
  });

  it("palabra más larga que la línea se corta con guion", () => {
    expect(wrapLabel("Supercalifragilístico", 10)).toEqual(["Supercali-", "fragilíst-", "ico"]);
  });
});
