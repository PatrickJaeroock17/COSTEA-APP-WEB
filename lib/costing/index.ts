// Motor de costos de costea, portado de legacy/Costea-main/costos_app/app/services.
// Funciones puras con decimal.js: sin base de datos ni red. Las pruebas en __tests__ son la especificación.
export * from "./decimal";
export * from "./materials";
export * from "./recipes";
export * from "./units";
export * from "./payroll";
export * from "./costing";
export * from "./planning";
export * from "./reports";
export * from "./labor";
export * from "./sales";
export * from "./inventory";
export { priceFromMargin, soles } from "./price";
