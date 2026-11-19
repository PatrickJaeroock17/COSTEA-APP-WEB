import { describe, expect, it } from "vitest";
import { NAV_GROUPS } from "@/lib/nav";
import { isVisibleAt, parseCostLevel } from "@/lib/cost-level";

const all = NAV_GROUPS.flatMap((g) => g.items);
const visible = (level: 1 | 2 | 3) => all.filter((i) => isVisibleAt(i.href, level)).map((i) => i.label);

describe("nivel de costeo", () => {
  it("nivel 1: Inicio, Insumos, Platos y recetas y Costo y precio", () => {
    expect(visible(1)).toEqual(["Inicio", "Insumos", "Platos y recetas", "Costo y precio por plato"]);
  });
  it("nivel 2 agrega Personal y el 3 muestra todo el menú", () => {
    expect(visible(2)).toContain("Personal");
    expect(visible(2)).not.toContain("Gastos");
    expect(visible(3)).toHaveLength(all.length);
  });
  it("un valor desconocido cae en el nivel 1", () => {
    expect(parseCostLevel(undefined)).toBe(1);
    expect(parseCostLevel(7)).toBe(1);
    expect(parseCostLevel("3")).toBe(3);
  });
});
