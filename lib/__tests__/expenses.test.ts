// Casos de ConceptForm y de la referencia normalizada de concept_edit (forms/planning.py, routes/planning.py).
import { describe, expect, it } from "vitest";
import { normalize, parseConcept } from "../expenses";

const base = { name: "Luz y agua", referenceKey: "", kind: "cif", amount: "800", behavior: "fixed", basis: "equivalent", justification: "Recibos de octubre", active: "on", targets: [] };

describe("gastos del mes", () => {
  it("normaliza la referencia: comprobante o, si falta, el nombre", () => {
    expect(parseConcept(base)).toMatchObject({ value: { referenceKey: "luz y agua", amount: "800", active: true, targets: [] } });
    expect(parseConcept({ ...base, referenceKey: "  F001-123   Sedapal " })).toMatchObject({ value: { referenceKey: "f001-123 sedapal" } });
    expect(normalize("  Gas   NATURAL ")).toBe("gas natural");
  });

  it("acepta destinatarios y excluir del cálculo", () => {
    expect(parseConcept({ ...base, targets: ["3", "3", "5"], active: undefined })).toMatchObject({ value: { targets: [3, 5], active: false } });
  });

  it.each([
    [{ name: "" }, "name"],
    [{ amount: "-5" }, "amount"],
    [{ amount: "1,000.00" }, "amount"],
    [{ kind: "impuesto" }, "kind"],
    [{ basis: "peso" }, "basis"],
    [{ behavior: "mixto" }, "behavior"],
    [{ justification: " " }, "justification"],
    [{ targets: ["x"] }, "targets"],
  ])("rechaza %#", (change, field) => {
    expect(parseConcept({ ...base, ...change })).toHaveProperty(`errors.${field}`);
  });
});
