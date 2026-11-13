// Casos de PayrollForm (forms/planning.py) y del costo mensual guardado (test_excel_improvements.py).
import { describe, expect, it } from "vitest";
import { D } from "../costing/decimal";
import { payrollInput } from "../costing/planning";
import { laborCost } from "../costing/costing";
import { PAYROLL_DEFAULTS, parsePayroll, payrollFormValues } from "../personal";

const base = { ...PAYROLL_DEFAULTS, source: "Contrato 2026", justification: "Cocina" };

describe("costo mensual detallado", () => {
  it("usa la planilla detallada y la tarifa por minuto del Excel", () => {
    const parsed = parsePayroll({
      ...base,
      salary: "1800",
      bonuses: "500",
      family_allowance: "50",
      gratification_july: "900",
      gratification_december: "900",
      cts_annual: "1800",
      extraordinary_percent: "0",
      essalud_base: "2500",
      productive: "90",
    });
    if (!("ok" in parsed)) throw new Error(JSON.stringify(parsed.errors));
    expect(parsed.ok.result.total.toFixed()).toBe("2875");
    expect(parsed.ok.result.minutes.toFixed()).toBe("11232");
    expect(parsed.ok.data.productive).toBe("0.9");
    // Lo guardado vuelve a dar el mismo costo por el adaptador del motor.
    const staff = payrollInput({ employeeId: 1, employee: { name: "Rosa" }, data: parsed.ok.data, breakdown: parsed.ok.breakdown as never });
    expect(laborCost(staff).rate!.eq(new D("2875").div("11232"))).toBe(true);
  });

  it("los errores de planilla no se vuelven cero", () => {
    expect(parsePayroll({ ...base, salary: "" })).toHaveProperty("errors.salary");
    expect(parsePayroll({ ...base, salary: "1000", eps_monthly: "100", eps_credit: "101" })).toHaveProperty("errors.mode");
  });
});

describe("costo mensual consolidado y reglas del formulario", () => {
  const consolidated = { ...base, mode: "consolidated", salary: "2000", charges: "400" };

  it("suma los cinco componentes", () => {
    const parsed = parsePayroll(consolidated);
    if (!("ok" in parsed)) throw new Error(JSON.stringify(parsed.errors));
    expect(parsed.ok.breakdown).toBeNull();
    expect(parsed.ok.result.total.toFixed()).toBe("2400");
    expect(payrollFormValues({ data: parsed.ok.data, breakdown: null })).toMatchObject({ mode: "consolidated", salary: "2000", charges: "400", productive: "100" });
  });

  it.each([
    [{ mod: "60", cif: "30" }, "sales"],
    [{ productive: "101" }, "productive"],
    [{ excluded: "12481" }, "excluded"],
    [{ direct_basis: "quantity", planned_units: "0" }, "planned_units"],
    [{ source: "" }, "source"],
    [{ justification: "" }, "justification"],
    [{ basis: "otro" }, "basis"],
  ])("rechaza %#", (change, field) => {
    expect(parsePayroll({ ...consolidated, ...change })).toHaveProperty(`errors.${field}`);
  });

  it("reparto mixto: la parte indirecta queda separada", () => {
    const parsed = parsePayroll({ ...consolidated, mod: "50", cif: "50" });
    if (!("ok" in parsed)) throw new Error(JSON.stringify(parsed.errors));
    expect(parsed.ok.result.cost.toFixed()).toBe("1200");
    expect(parsed.ok.result.indirect.cif.toFixed()).toBe("1200");
  });
});
