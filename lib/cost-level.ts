// Nivel de costeo del restaurante: capa de presentación (qué menú y qué pasos se muestran).
// No cambia ningún cálculo: las rutas avanzadas siguen existiendo y los datos se conservan al subir o bajar de nivel.
export type CostLevel = 1 | 2 | 3;

export const COST_LEVELS: { level: CostLevel; name: string; text: string; includes: string }[] = [
  {
    level: 1,
    name: "Costo rápido",
    text: "Cuánto te cuesta cada plato y a qué precio venderlo, solo con tus insumos.",
    includes: "Insumos · Platos y recetas · Costo y precio",
  },
  {
    level: 2,
    name: "Con mi tiempo",
    text: "Suma el trabajo de tu equipo: personal y minutos que toma cada plato.",
    includes: "Todo lo anterior + Personal",
  },
  {
    level: 3,
    name: "Costo completo",
    text: "Incluye gastos del local, plan de producción, presupuestos, ventas, inventario y reportes.",
    includes: "Todos los módulos",
  },
];

/** Nivel mínimo con el que cada módulo aparece en el menú. */
const MIN_LEVEL: Record<string, CostLevel> = {
  "/app": 1,
  "/app/insumos": 1,
  "/app/platos": 1,
  "/app/costos": 1,
  "/app/personal": 2,
  "/app/gastos": 3,
  "/app/plan": 3,
  "/app/presupuestos": 3,
  "/app/ventas": 3,
  "/app/inventario": 3,
  "/app/reportes": 3,
};

export const minLevelOf = (href: string): CostLevel => MIN_LEVEL[href] ?? 3;
export const isVisibleAt = (href: string, level: CostLevel) => minLevelOf(href) <= level;

export function parseCostLevel(value: unknown): CostLevel {
  const n = Number(value);
  return n === 2 || n === 3 ? n : 1;
}

export const costLevelName = (level: CostLevel) => COST_LEVELS.find((l) => l.level === level)!.name;
