import { expect } from "vitest";
import { D, type Dec, type Key, type Num } from "../decimal";
import type { PlanInput, StaffInput } from "../costing";

/** Igualdad decimal exacta (como `==` entre Decimal en Python). */
export function eq(actual: Dec | null | undefined, expected: Num, label = "") {
  expect(actual, label).not.toBeNull();
  expect(actual, label).not.toBeUndefined();
  expect(actual!.toFixed(), label).toBe(new D(expected).toFixed());
}

/** |a − b| < tolerancia */
export function near(actual: Dec | null | undefined, expected: Num, tolerance: Num, label = "") {
  expect(actual, label).not.toBeNull();
  expect(actual!.minus(expected).abs().lt(tolerance), `${label}: ${actual} ≉ ${expected}`).toBe(true);
}

export const mapText = (m: Map<Key, Dec>) => Object.fromEntries([...m].map(([k, v]) => [String(k), v.toFixed()]));

export const clone = <T>(value: T): T => structuredClone(value);

// legacy: tests/test_costing_engine.py → employee() y scenario()
export function employee(mod = "1"): StaffInput {
  return {
    id: 1,
    name: "Operario",
    components: [{ name: "Costo mensual", amount: "2400", source: "Prueba" }],
    fractions: { mod, cif: new D(1).minus(mod).toFixed(), admin: "0", sales: "0" },
    days: "20",
    hours: "8",
    excluded: "0",
    productive: ".8",
    basis: "equivalent",
    justification: "Mismo producto",
  };
}

export function scenario(quantity = "800"): PlanInput {
  return {
    staff: [employee()],
    noCif: false,
    noExpenses: false,
    concepts: [
      { id: "cif", name: "CIF", kind: "cif", amount: "800", basis: "equivalent", targets: [], justification: "Iguales" },
      { id: "expense", name: "Gastos", kind: "admin", amount: "400", basis: "equivalent", targets: [], justification: "Iguales" },
    ],
    lines: [
      {
        id: 1,
        productId: 1,
        name: "Producto",
        unit: "ud",
        quantity,
        output: "20",
        noMaterials: false,
        noLabor: false,
        materials: [{ name: "Material", version: 1, quantity: "1", factor: "1", unitCost: "120", mode: "gross", rate: "0" }],
        operations: [{ employeeId: 1, activity: "Producir", minutes: "160" }],
        equivalentFactor: "1",
        referencePrice: "15",
        pricingMode: "manual",
        pricingValue: "17.70",
        tax: ".18",
        adoptedPrice: null,
      },
    ],
  };
}
