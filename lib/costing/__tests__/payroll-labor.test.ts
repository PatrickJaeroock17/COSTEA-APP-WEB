// Port de test_excel_improvements.py (planilla), test_labor_table.py y test_worker_minutes.py (parte de cálculo).
import { describe, expect, it } from "vitest";
import { D } from "../decimal";
import { PAYROLL_FIELDS, type PayrollInputs, monthlyPayroll } from "../payroll";
import { recipeLaborTable, workerMinutes } from "../labor";
import { payrollInput } from "../planning";
import { eq, employee } from "./helpers";

function detailedInputs(changes: PayrollInputs = {}): PayrollInputs {
  const values: PayrollInputs = Object.fromEntries(PAYROLL_FIELDS.map((k) => [k, "0"]));
  Object.assign(values, {
    salary: "1800",
    bonuses: "500",
    family_allowance: "50",
    gratification_july: "900",
    gratification_december: "900",
    cts_annual: "1800",
    essalud_percent: "9",
    essalud_base: null,
    sctr_base: null,
  });
  return { ...values, ...changes };
}

describe("planilla mensual", () => {
  it("corrige la omisión de CTS del Excel y las bases son explícitas", () => {
    // Hoja1 C5:H5 con J5 sobre I5=2500 explícito. K5=2725 omitía H5=150; el total correcto es 2875.
    let result = monthlyPayroll(detailedInputs({ essalud_base: "2500" }));
    eq(result.total, "2875");
    eq(result.components.reduce((a, c) => a.plus(c.amount), new D(0)), result.total.toFixed());
    // La base por defecto excluye provisiones de beneficios.
    result = monthlyPayroll(detailedInputs());
    eq(result.essaludBaseApplied, "2350");
    eq(result.total, "2861.50");
  });

  it("base mínima, crédito EPS y SCTR sin doble conteo", () => {
    const result = monthlyPayroll(
      detailedInputs({
        essalud_minimum_base: "2500",
        sctr_percent: "1.5",
        sctr_base: "2000",
        eps_monthly: "100",
        eps_credit: "50",
        extraordinary_percent: "6.75",
      }),
    );
    eq(result.essaludGross, "225");
    eq(result.total, "2965.125");
    expect(() => monthlyPayroll(detailedInputs({ eps_monthly: "100", eps_credit: "101" }))).toThrow(/crédito EPS/);
  });

  it.each<PayrollInputs>([{ salary: "NaN" }, { salary: "-1" }, { essalud_percent: "101" }, { cts_annual: null }])(
    "datos inválidos o faltantes nunca se vuelven cero %#",
    (change) => {
      expect(() => monthlyPayroll(detailedInputs(change))).toThrow();
    },
  );

  it("payrollInput usa la planilla detallada cuando existe", () => {
    const staff = payrollInput({
      employeeId: 7,
      employee: { name: "Cocinera" },
      data: {
        components: [{ name: "Sueldo", amount: "1", source: "Contrato" }],
        fractions: { mod: "1", cif: "0", admin: "0", sales: "0" },
        days: "26",
        hours: "8",
        excluded: "0",
        productive: ".9",
        basis: "equivalent",
        justification: "Cocina",
      },
      breakdown: { inputs: detailedInputs({ essalud_base: "2500" }) },
    });
    expect(staff.components).toHaveLength(11);
    expect(staff.components.every((c) => c.source === "Contrato")).toBe(true);
    expect(staff.directBasis).toBe("time");
    eq(staff.components.reduce((a, c) => a.plus(c.amount), new D(0)), "2875");
  });
});

describe("MOD por receta (test_labor_table.py)", () => {
  const employees = [{ id: 1, name: "Operario" }];

  it("suma los minutos de varias actividades sin duplicar el sueldo", () => {
    const work = { operations: [{ employeeId: 1, activity: "Producir", minutes: "160" }], noLabor: false };
    let result = recipeLaborTable(employees, [employee()], "20", work);
    eq(result.total, "50");
    eq(result.perPortion, "2.5");
    eq(result.rows[0].minutes, "160");
    eq(result.rows[0].rate, ".3125");
    work.operations.push({ employeeId: 1, activity: "Servir", minutes: "16" });
    result = recipeLaborTable(employees, [employee()], "20", work);
    eq(result.total, "55");
    expect(recipeLaborTable(employees, [], "20", work).total).toBeNull();
  });

  it("tarifa del Excel para un trabajador nuevo", () => {
    const worker = { ...employee(), components: [{ amount: "2725" }], days: "26", productive: ".9" };
    const result = recipeLaborTable(employees, [worker], "20", {
      operations: [{ employeeId: 1, activity: "Cocinar", minutes: "10" }],
      noLabor: false,
    });
    eq(result.rows[0].rate, new D("2725").div("11232").toFixed());
    eq(result.total, new D("2725").div("11232").times(10).toFixed());
  });

  it("pide operaciones o declaración sin MOD", () => {
    expect(recipeLaborTable(employees, [employee()], "20", null).issues).toHaveLength(1);
    expect(recipeLaborTable(employees, [employee()], "20", { operations: [], noLabor: true }).total).not.toBeNull();
  });
});

describe("minutos del mes (test_worker_minutes.py)", () => {
  it("minutos, productividad y sin tarifas inventadas", () => {
    const data = { ...employee(), components: [{ amount: "2725" }], days: "26", hours: "8", productive: ".9", excluded: "0" };
    let row = workerMinutes(data);
    eq(row.programmed, "12480");
    eq(row.effective, "11232");
    eq(row.productive, ".9");
    eq(row.rate, new D("2725").div("11232").toFixed());
    row = workerMinutes({ ...data, excluded: "480", productive: ".85" });
    eq(row.effective, "10200");
    expect(workerMinutes({ ...data, productive: "0" }).rate).toBeNull();
  });
});
