// Guardado del costo mensual con el formulario tal como se renderiza (bug: planned_units no estaba en
// pantalla pero se exigía). Se renderiza PayrollForm, se leen los campos que el navegador enviaría y se
// validan con la misma función que usa la acción del servidor.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/actions/personal", () => ({
  savePayroll: vi.fn(),
  createEmployee: vi.fn(),
  updateEmployee: vi.fn(),
  deleteEmployee: vi.fn(),
  addOperation: vi.fn(),
  removeOperation: vi.fn(),
  setRecipeWork: vi.fn(),
}));

import { PayrollForm } from "../forms";
import { PAYROLL_DEFAULTS, type PayrollFormValues, parsePayroll, payrollErrorMessage } from "@/lib/personal";

const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** Campos que el navegador enviaría: inputs con name (radios solo el marcado) y selects con su opción elegida. */
function submittedFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const tag of html.match(/<input\b[^>]*>/g) ?? []) {
    const name = /\bname="([^"]*)"/.exec(tag)?.[1];
    if (!name) continue;
    const type = /\btype="([^"]*)"/.exec(tag)?.[1];
    if ((type === "radio" || type === "checkbox") && !/\bchecked=""/.test(tag)) continue;
    fields[name] = decode(/\bvalue="([^"]*)"/.exec(tag)?.[1] ?? "");
  }
  for (const [, name, body] of html.matchAll(/<select\b[^>]*\bname="([^"]*)"[^>]*>([\s\S]*?)<\/select>/g)) {
    const chosen = /<option[^>]*\bvalue="([^"]*)"[^>]*\bselected=""/.exec(body) ?? /<option[^>]*\bvalue="([^"]*)"/.exec(body);
    fields[name] = decode(chosen?.[1] ?? "");
  }
  return fields;
}

const render = (initial: PayrollFormValues) =>
  submittedFields(renderToStaticMarkup(<PayrollForm employeeId={7} periodId={3} periodLabel="Noviembre 2026" initial={initial} currency="PEN" />));

describe("formulario de costo mensual tal como se renderiza", () => {
  it("con reparto por minutos no muestra ni exige las porciones previstas, y se guarda", () => {
    const fields = render({ ...PAYROLL_DEFAULTS, salary: "1800", source: "Contrato 2026", justification: "Cocina" });
    expect(fields).not.toHaveProperty("planned_units");
    expect(fields).toMatchObject({ mode: "detailed", direct_basis: "time", salary: "1800" });
    const parsed = parsePayroll(fields);
    expect(parsed).toHaveProperty("ok");
    if ("ok" in parsed) expect(parsed.ok.data.planned_units).toBe("0");
  });

  it("modo consolidado también se guarda con los campos visibles", () => {
    const fields = render({ ...PAYROLL_DEFAULTS, mode: "consolidated", salary: "2000", source: "Boletas", justification: "Cocina" });
    expect(fields.mode).toBe("consolidated");
    expect(parsePayroll(fields)).toHaveProperty("ok");
  });

  it("con reparto por porciones muestra el campo con ayuda y lo exige", () => {
    const html = renderToStaticMarkup(
      <PayrollForm employeeId={7} periodId={3} periodLabel="Noviembre 2026" initial={{ ...PAYROLL_DEFAULTS, salary: "1800", source: "x", justification: "y", direct_basis: "quantity" }} currency="PEN" />,
    );
    expect(html).toContain("Porciones mensuales previstas");
    expect(html).toContain("su costo directo se divide entre ellas");
    const parsed = parsePayroll(submittedFields(html));
    expect(parsed).toHaveProperty("errors.planned_units");
  });
});

describe("mensaje de error", () => {
  it("nombra los campos con problema", () => {
    expect(payrollErrorMessage({ planned_units: "x" })).toBe("Revisa este dato: Porciones mensuales previstas.");
    expect(payrollErrorMessage({ source: "x", salary: "y" })).toBe("Revisa estos datos: Sustento y composición de los importes, Sueldo básico mensual.");
    expect(payrollErrorMessage({ salary: "y" }, "consolidated")).toBe("Revisa este dato: Remuneración.");
    expect(payrollErrorMessage({ mode: "El crédito EPS no puede superar EsSalud ni la prima EPS mensual." })).toMatch(/crédito EPS/);
  });
});
