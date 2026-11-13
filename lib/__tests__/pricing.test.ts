// Casos de PlanLineForm (forms/planning.py) y del guardado en plan_line (porcentaje → fracción).
import { describe, expect, it } from "vitest";
import { parsePlanLine, pricingInput } from "../pricing";

const base = { quantity: "800", referencePrice: "15", equivalentFactor: "1", pricingMode: "food_cost", pricingValue: "30", adoptedPrice: "" };

describe("línea del plan", () => {
  it("guarda los objetivos como fracción y el precio manual tal cual", () => {
    expect(parsePlanLine(base)).toEqual({
      value: { quantity: "800", referencePrice: "15", equivalentFactor: "1", pricingMode: "food_cost", pricingValue: "0.3", adoptedPrice: null },
    });
    expect(parsePlanLine({ ...base, pricingMode: "manual", pricingValue: "17.70", adoptedPrice: "18" })).toMatchObject({ value: { pricingValue: "17.70", adoptedPrice: "18" } });
    expect(pricingInput("margin", "0.25")).toBe("25");
    expect(pricingInput("manual", "17.70")).toBe("17.7");
  });

  it.each([
    [{ pricingValue: "0" }, "pricingValue"],
    [{ pricingValue: "101" }, "pricingValue"],
    [{ pricingMode: "margin", pricingValue: "100" }, "pricingValue"],
    [{ quantity: "0" }, "quantity"],
    [{ equivalentFactor: "0" }, "equivalentFactor"],
    [{ referencePrice: "-1" }, "referencePrice"],
    [{ pricingMode: "otro" }, "pricingMode"],
  ])("rechaza %#", (change, field) => {
    expect(parsePlanLine({ ...base, ...change })).toHaveProperty(`errors.${field}`);
  });
});
