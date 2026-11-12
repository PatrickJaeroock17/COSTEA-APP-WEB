import {
  BarChart3,
  CalendarClock,
  ChefHat,
  FileCheck2,
  Home,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Tag,
  Users,
  Boxes,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Qué hará el módulo (se muestra mientras no esté construido). */
  desc: string;
  /** Fase del plan en la que se construye. */
  phase: string;
};

export type NavGroup = { label: string | null; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ href: "/app", label: "Inicio", icon: Home, desc: "Progreso de configuración y resultados clave.", phase: "Fase 15" }],
  },
  {
    label: "Preparar",
    items: [
      { href: "/app/insumos", label: "Insumos", icon: Package, desc: "Catálogo de insumos con versiones de precio.", phase: "Fase 6" },
      { href: "/app/platos", label: "Platos y recetas", icon: ChefHat, desc: "Platos, recetas con versiones y precios.", phase: "Fase 7" },
      { href: "/app/personal", label: "Personal", icon: Users, desc: "Planilla y costo de mano de obra directa e indirecta.", phase: "Fase 8" },
      { href: "/app/gastos", label: "Gastos", icon: Receipt, desc: "Costos indirectos, gastos de administración y de ventas.", phase: "Fase 9" },
    ],
  },
  {
    label: "Costear",
    items: [
      { href: "/app/costos", label: "Costo y precio por plato", icon: Tag, desc: "Costo completo de cada plato y precio sugerido según el margen.", phase: "Fase 10" },
      { href: "/app/plan", label: "Plan de producción", icon: CalendarClock, desc: "Cuántos platos preparar y qué insumos necesitas.", phase: "Fase 11" },
      { href: "/app/presupuestos", label: "Presupuestos", icon: FileCheck2, desc: "Presupuestos mensuales; al publicarse quedan fijos.", phase: "Fase 12" },
    ],
  },
  {
    label: "Operar",
    items: [
      { href: "/app/ventas", label: "Ventas", icon: ShoppingCart, desc: "Registro de ventas, ingresos, costos y utilidad del mes.", phase: "Fase 13" },
      { href: "/app/inventario", label: "Inventario", icon: Boxes, desc: "Kardex con costo promedio ponderado.", phase: "Fase 14" },
    ],
  },
  {
    label: "Analizar",
    items: [{ href: "/app/reportes", label: "Reportes", icon: BarChart3, desc: "Reportes de costos, ventas y presupuesto.", phase: "Fase 15" }],
  },
];

export const SETTINGS_ITEM: NavItem = {
  href: "/app/configuracion",
  label: "Configuración",
  icon: Settings,
  desc: "Datos del restaurante, unidades de medida y periodos.",
  phase: "Fase 5",
};

export const ALL_ITEMS: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM];

