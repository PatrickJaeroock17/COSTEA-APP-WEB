// Verificación del motor contra el Excel del curso: legacy/Costea-main/"2026 2 UNI CCP COSTOS DE RESTAURANTES.xlsx"
// (paso 5 de CLAUDE.md). Cada valor esperado indica su hoja y celda. Tolerancias: S/ 0.01 por porción y
// S/ 0.05 en totales. Las diferencias reales del Excel (fórmulas o importes tipeados inconsistentes, redondeos
// intermedios) se prueban como diferencias conocidas: el motor da el valor aritmético correcto y la prueba fija
// cuánto se aparta el Excel. `EXCEL_REPORT=1 npx vitest run lib/costing/__tests__/excel-uni.test.ts` imprime la tabla.
import { afterAll, describe, expect, it } from "vitest";
import { D, type Dec, type Num } from "../decimal";
import { type PlanInput, type PlanLineInput, type StaffInput, allocation, calculatePlan, laborCost } from "../costing";
import { inventoryPrice, ledger, type Movement } from "../inventory";
import { monthlyPayroll } from "../payroll";
import { calculateLine } from "../recipes";

const PORTION = "0.01";
const TOTAL = "0.05";
type Row = { caso: string; concepto: string; celda: string; excel: string; motor: string; diferencia: string; ok: string; nota?: string };
const report: Row[] = [];

/** Compara y registra; falla si la diferencia supera la tolerancia. */
function check(caso: string, concepto: string, celda: string, excel: Num, motor: Dec, tol: string) {
  const diff = motor.minus(excel);
  const ok = diff.abs().lte(tol);
  report.push({ caso, concepto, celda, excel: new D(excel).toDecimalPlaces(4).toFixed(), motor: motor.toDecimalPlaces(4).toFixed(), diferencia: diff.toDecimalPlaces(4).toFixed(), ok: ok ? "OK" : "NO" });
  expect(ok, `${caso} · ${concepto} (${celda}): Excel ${excel} vs motor ${motor.toFixed()}`).toBe(true);
}

/** Diferencia conocida del Excel: el motor da `motor` y el Excel se aparta exactamente `expectedDiff`. */
function known(caso: string, concepto: string, celda: string, excel: Num, motor: Dec, expectedDiff: Num, nota: string) {
  const diff = motor.minus(excel);
  report.push({ caso, concepto, celda, excel: new D(excel).toDecimalPlaces(4).toFixed(), motor: motor.toDecimalPlaces(4).toFixed(), diferencia: diff.toDecimalPlaces(4).toFixed(), ok: "NO", nota });
  expect(diff.minus(expectedDiff).abs().lte("0.0001"), `${caso} · ${concepto}: diferencia ${diff.toFixed()} ≠ ${expectedDiff}`).toBe(true);
}

afterAll(() => {
  if (process.env.EXCEL_REPORT) console.table(report);
});

/* ───────────── Datos comunes de Hoja2 ───────────── */

// Hoja2 C58:G61 — costo por minuto: sueldo (Hoja1 K5:K8) / (26 días × 8 h × 60 min × productividad).
const staff = (id: number, name: string, total: string, productive: string): StaffInput => ({
  id,
  name,
  components: [{ amount: total }],
  fractions: { mod: "1", cif: "0", admin: "0", sales: "0" },
  days: "26",
  hours: "8",
  excluded: "0",
  productive,
  basis: "sales",
  justification: "Hoja2 C58:G61",
});
const CHEF = staff(1, "Cheff", "2725", "0.9"); //   Hoja2 C58 (=Hoja1!K5), E58
const COOK = staff(2, "Cocinero", "1635", "0.85"); // Hoja2 C59 (=Hoja1!K6), E59
const HELP = staff(3, "Ayudante", "1308", "0.85"); // Hoja2 C60 (=Hoja1!K7), E60
const DISH = staff(4, "Lavaplatos", "1231.7", "0.95"); // Hoja2 C61 (=Hoja1!K8), E61

// Hoja2 B68:E83 — plan de producción (cantidad mes y VV por plato). Total C84 = 9618, F84 = 263170.
const PLAN: [string, string, string][] = [
  ["CEVICHE", "468", "40"], // C68 = 18*26, E68
  ["LOMO SALTADO", "520", "35"], // C69 = 20*26, E69
  ["AJI DE GALLINA", "750", "25"],
  ["ARROZ CHAUFA", "600", "20"],
  ["PARIHUELA", "300", "40"],
  ["OCOPA", "750", "15"],
  ["PAPA LA HUANCAINA", "600", "15"],
  ["DUO MARINO", "750", "45"],
  ["ESCABECHE", "80", "25"],
  ["CAU CAU", "600", "20"],
  ["CUBANA", "750", "15"],
  ["LOMO DE POLLO", "750", "30"],
  ["POLLO A LA BRASA", "600", "60"],
  ["MONDONGUITO", "750", "20"],
  ["SECO DE RES", "750", "25"],
  ["HUEVERA FRITA", "600", "20"],
];

// Hoja2 B32:C47 — CIF y gastos del mes, repartidos por participación en ventas (D32 = G68 = F68/F84) y divididos
// entre la cantidad del mes (E32 = C68): equivale a la base "ventas de referencia" del motor.
const concept = (id: string, name: string, kind: "cif" | "admin" | "sales", amount: string) => ({ id, name, kind, amount, basis: "sales" as const, targets: [], justification: "Hoja2" });
const CONCEPTS = [
  concept("alquiler", "Alquiler", "cif", "8000"), // C32
  concept("mantenimiento", "Mantenimiento", "cif", "600"), // C33
  concept("seguros", "Seguros", "cif", "250"), // C34
  concept("gas", "Gas", "cif", "1000"), // C35
  concept("luz", "Luz", "cif", "4000"), // C36
  concept("agua", "Agua", "cif", "750"), // C37
  concept("mozos", "Mozos", "cif", "4500"), // C38
  concept("personal-adm", "Personal adm", "admin", "6000"), // C41
  concept("contador", "Contador", "admin", "3000"), // C42
  concept("utiles", "Útiles de escritorio", "admin", "500"), // C43
  concept("publicidad", "Publicidad", "sales", "1000"), // C46
  concept("propaganda", "Propaganda", "sales", "600"), // C47
];

// Hoja2 C90:L91 — kardex del pescado: saldo 10 kg a 80 y compra de 20 kg a 78 → promedio K91 = 2360/30.
const fish: Movement[] = [
  { id: 1, materialId: "pescado", movementOn: "2026-03-01", kind: "in", quantity: "10", unitCost: "80" }, // J90, K90
  { id: 2, materialId: "pescado", movementOn: "2026-03-02", kind: "in", quantity: "20", unitCost: "78" }, // D91, E91
];
const [fishPrice] = inventoryPrice(fish, "2026-03-02");

type Mat = { name: string; quantity: string; factor: string; unitCost: Num; cell: string; excel: string };

// Hoja2 B14:G23 — ceviche de mero de 250 g. `excel` es el COSTO de la fila (columna G).
const CEVICHE: Mat[] = [
  { name: "Pescado", quantity: "250", factor: "0.001", unitCost: fishPrice!, cell: "G14", excel: "19.666666666666668" },
  // 8 limones a S/ 5 el kg: G15 = 2.5 tipeado ⇒ 8 unidades = 0.5 kg (0.0625 kg por limón).
  { name: "Limón", quantity: "8", factor: "0.0625", unitCost: "5", cell: "G15", excel: "2.5" },
  { name: "Cebolla", quantity: "80", factor: "0.001", unitCost: "2.5", cell: "G16", excel: "0.2" },
  { name: "Ajo", quantity: "50", factor: "0.001", unitCost: "8", cell: "G17", excel: "0.4" },
  { name: "Ajilimo", quantity: "1", factor: "1", unitCost: "0.5", cell: "G18", excel: "0.5" },
  { name: "Camote", quantity: "200", factor: "0.001", unitCost: "3", cell: "G19", excel: "2" },
  // Apio: E20 dice S/ 2 por ATADO, pero G20 = (50/1000)×2 lo trata como S/ 2 por kg; se replica esa lectura.
  { name: "Apio", quantity: "50", factor: "0.001", unitCost: "2", cell: "G20", excel: "0.1" },
  { name: "Comino", quantity: "0.5", factor: "1", unitCost: "0.5", cell: "G21", excel: "0.25" },
  { name: "Sal", quantity: "30", factor: "0.001", unitCost: "2", cell: "G22", excel: "0.06" },
  { name: "Ajinomoto", quantity: "1", factor: "1", unitCost: "1.5", cell: "G23", excel: "0.75" },
];

// Hoja2 I14:N23 — lomo saltado.
const LOMO: Mat[] = [
  { name: "Carne de res", quantity: "200", factor: "0.001", unitCost: "35", cell: "N14", excel: "7" },
  { name: "Papa blanca", quantity: "100", factor: "0.001", unitCost: "8", cell: "N15", excel: "0.8" },
  { name: "Cebolla", quantity: "80", factor: "0.001", unitCost: "6", cell: "N16", excel: "0.48" },
];

const amount = (m: Mat) => calculateLine({ quantity: m.quantity, factor: m.factor, unitCost: m.unitCost }).amount;

/** Plan del mes con los 16 platos de Hoja2; ceviche y lomo con su receta, el resto solo como base de reparto. */
function plan(ceviche: Mat[], cevicheTax: string): PlanInput {
  const lines: PlanLineInput[] = PLAN.map(([name, quantity, vv], i) => ({
    id: i + 1,
    productId: i + 1,
    name,
    unit: "porción",
    quantity,
    output: "1",
    noMaterials: i > 1,
    noLabor: i > 1,
    materials: [],
    operations: [],
    equivalentFactor: "1",
    referencePrice: vv, // E68:E83 — VV (sin impuesto)
    pricingMode: "manual",
    pricingValue: new D(vv).times("1.18").toFixed(),
    tax: "0.18",
    adoptedPrice: null,
  }));
  Object.assign(lines[0], {
    materials: ceviche.map((m, j) => ({ name: m.name, materialId: `c${j}`, version: 1, quantity: m.quantity, factor: m.factor, unitCost: new D(m.unitCost).toFixed(), mode: "gross", rate: "0" })),
    // D27 = 0 (cheff no participa), D28 = 5 min cocinero, D29 = 8 min ayudante.
    operations: [
      { employeeId: 2, activity: "Preparar", minutes: "5" },
      { employeeId: 3, activity: "Apoyar", minutes: "8" },
    ],
    // G53: precio con impuesto. Se usa precio manual para comparar VV, IGV y ganancia.
    pricingValue: "45.12631821909872",
    tax: cevicheTax,
  });
  Object.assign(lines[1], {
    materials: LOMO.map((m, j) => ({ name: m.name, materialId: `l${j}`, version: 1, quantity: m.quantity, factor: m.factor, unitCost: m.unitCost, mode: "gross", rate: "0" })),
    // K27 = 8 min cheff, K28 = 0 cocinero, K29 = 6 min ayudante.
    operations: [
      { employeeId: 1, activity: "Saltear", minutes: "8" },
      { employeeId: 3, activity: "Apoyar", minutes: "6" },
    ],
    pricingValue: "29.543798579562036", // N53
    tax: "0.18", // N52 = 0.18 × N51
  });
  return { staff: [CHEF, COOK, HELP, DISH], noCif: false, noExpenses: false, concepts: CONCEPTS, lines };
}

/* ───────────── Pruebas ───────────── */

describe("Hoja2 · costo por minuto de la mano de obra (C58:G61)", () => {
  it.each([
    ["Cheff", CHEF, "11232", "0.24261039886039887", "F58", "G58"],
    ["Cocinero", COOK, "10608", "0.1541289592760181", "F59", "G59"],
    ["Ayudante", HELP, "10608", "0.12330316742081449", "F60", "G60"],
    ["Lavaplatos", DISH, "11856", "0.10388832658569501", "F61", "G61"],
  ])("%s", (name, s, minutes, rate, fCell, gCell) => {
    const c = laborCost(s);
    check("Personal", `${name}: minutos efectivos`, `Hoja2 ${fCell}`, minutes, c.minutes, TOTAL);
    check("Personal", `${name}: costo por minuto`, `Hoja2 ${gCell}`, rate, c.rate!, PORTION);
  });
});

describe("Hoja2 · ceviche de mero (B9:G53)", () => {
  it("materia prima línea por línea (G14:G23)", () => {
    for (const m of CEVICHE) {
      if (m.name === "Camote") {
        known("Ceviche", "Camote 200 g a S/ 3/kg", "Hoja2 G19", m.excel, amount(m), "-1.4", "G19 = C19/100 = 2; debía ser (200/1000)×3 = 0.60");
      } else if (m.name === "Ajinomoto") {
        known("Ceviche", "Ajinomoto 1 sobre a S/ 1.50", "Hoja2 G23", m.excel, amount(m), "0.75", "G23 = 0.75 tipeado; C23×E23 = 1 × 1.50 = 1.50");
      } else {
        check("Ceviche", `${m.name}`, `Hoja2 ${m.cell}`, m.excel, amount(m), PORTION);
      }
    }
  });

  it("costeo completo con las cifras del Excel (G24:G53)", () => {
    // Para validar la cadena completa se reproducen los dos importes tipeados del Excel (camote 2.00, ajinomoto 0.75).
    const faithful = CEVICHE.map((m) => (m.name === "Camote" ? { ...m, unitCost: "10" } : m.name === "Ajinomoto" ? { ...m, unitCost: "0.75" } : m));
    const result = calculatePlan(plan(faithful, "0.10"));
    const row = result.rows[0];
    const q = row.quantity;
    check("Ceviche", "Materia prima / porción", "Hoja2 G24", "26.426666666666666", row.cmp, PORTION);
    check("Ceviche", "MOD / porción", "Hoja2 G30", "1.7570701357466065", row.mod, PORTION);
    check("Ceviche", "CIF / porción", "Hoja2 G39", "2.9030664589428885", row.cif.div(q), PORTION);
    check("Ceviche", "Alquiler / porción", "Hoja2 G32", "1.2159440665729377", new D(result.allocations[0].exact.get(1)!).div(q), PORTION);
    check("Ceviche", "Gastos administrativos / porción", "Hoja2 G44", "1.4439335790553636", row.admin.div(q), PORTION);
    check("Ceviche", "Gastos de ventas / porción", "Hoja2 G48", "0.24318881331458755", row.selling.div(q), PORTION);
    check("Ceviche", "Costo total / porción", "Hoja2 G49", "32.77392565372611", row.complete!, PORTION);
    check("Ceviche", "Valor de venta (sin impuesto)", "Hoja2 G51", "41.02392565372611", row.price!.net, PORTION);
    check("Ceviche", "Impuesto (10 % en el Excel)", "Hoja2 G52", "4.102392565372611", row.price!.tax, PORTION);
    check("Ceviche", "Precio de venta", "Hoja2 G53", "45.12631821909872", row.price!.final, PORTION);
    check("Ceviche", "Ganancia por porción", "Hoja2 G50", "8.25", row.price!.result, PORTION);
    check("Ceviche", "Pescado del día (18 platos)", "Hoja2 I6", "354", amount(CEVICHE[0]).times(18), TOTAL);
  });

  it("costeo completo con la aritmética correcta de las entradas", () => {
    const result = calculatePlan(plan(CEVICHE, "0.10"));
    known("Ceviche", "Materia prima / porción (corregida)", "Hoja2 G24", "26.426666666666666", result.rows[0].cmp, "-0.65", "Camote −1.40 y ajinomoto +0.75");
    known("Ceviche", "Costo total / porción (corregido)", "Hoja2 G49", "32.77392565372611", result.rows[0].complete!, "-0.65", "Arrastra la diferencia de materia prima");
  });
});

describe("Hoja2 · lomo saltado (I9:N53)", () => {
  it("materia prima y costeo completo", () => {
    for (const m of LOMO) check("Lomo saltado", m.name, `Hoja2 ${m.cell}`, m.excel, amount(m), PORTION);
    const result = calculatePlan(plan(CEVICHE, "0.10"));
    const row = result.rows[1];
    const q = row.quantity;
    check("Lomo saltado", "Materia prima / porción", "Hoja2 N24", "8.28", row.cmp, PORTION);
    check("Lomo saltado", "MOD / porción", "Hoja2 N30", "2.680702195408078", row.mod, PORTION);
    check("Lomo saltado", "CIF / porción", "Hoja2 N39", "2.540183151575027", row.cif.div(q), PORTION);
    check("Lomo saltado", "Gastos administrativos / porción", "Hoja2 N44", "1.263441881673443", row.admin.div(q), PORTION);
    check("Lomo saltado", "Gastos de ventas / porción", "Hoja2 N48", "0.21279021165026407", row.selling.div(q), PORTION);
    check("Lomo saltado", "Costo total / porción", "Hoja2 N49", "14.977117440306811", row.complete!, PORTION);
    check("Lomo saltado", "Valor de venta (sin IGV)", "Hoja2 N51", "25.03711744030681", row.price!.net, PORTION);
    check("Lomo saltado", "IGV 18 %", "Hoja2 N52", "4.5066811392552255", row.price!.tax, PORTION);
    check("Lomo saltado", "Precio de venta", "Hoja2 N53", "29.543798579562036", row.price!.final, PORTION);
    check("Lomo saltado", "Ganancia por porción", "Hoja2 N50", "10.06", row.price!.result, PORTION);
  });

  it("el plan concilia y la MOD ociosa queda como costo del periodo (el Excel no la calcula)", () => {
    const result = calculatePlan(plan(CEVICHE, "0.10"));
    expect(result.totals.difference.abs().lte("0.00000001")).toBe(true);
    // Hoja2 no tiene celda de MOD ociosa: el motor la informa (sueldos − MOD asignada a ceviche y lomo).
    const assigned = new D("1.7570701357466065").times(468).plus(new D("2.680702195408078").times(520));
    check("Plan", "MOD asignada en el mes (G30×C68 + N30×C69)", "Hoja2 G30, N30, C68, C69", assigned, result.totals.modAssigned, TOTAL);
    report.push({ caso: "Plan", concepto: "MOD ociosa del mes", celda: "— (no está en el Excel)", excel: "—", motor: result.totals.idle.toDecimalPlaces(4).toFixed(), diferencia: "—", ok: "—" });
  });
});

describe("Hoja2 · kardex del pescado (C88:L94)", () => {
  const moves: Movement[] = [
    ...fish,
    { id: 3, materialId: "pescado", movementOn: "2026-03-03", kind: "out", quantity: "4.5", unitCost: "0" }, // G92
    { id: 4, materialId: "pescado", movementOn: "2026-03-04", kind: "out", quantity: "24", unitCost: "0" }, // G93
    { id: 5, materialId: "pescado", movementOn: "2026-03-05", kind: "in", quantity: "15", unitCost: "85" }, // D94, E94
  ];
  it("promedio ponderado; el Excel redondea el costo unitario de las salidas a 78.67", () => {
    const rows = ledger(moves);
    check("Kardex", "Saldo tras la compra (cantidad)", "Hoja2 J91", "30", rows[1].quantity, TOTAL);
    check("Kardex", "Promedio tras la compra", "Hoja2 K91", "78.66666666666667", rows[1].average!, PORTION);
    check("Kardex", "Valor tras la compra", "Hoja2 L91", "2360", rows[1].value!, TOTAL);
    check("Kardex", "Costo de la salida de 4.5 kg", "Hoja2 I92", "354.015", rows[2].cost!, TOTAL);
    known("Kardex", "Valor tras salir 4.5 kg", "Hoja2 L92", "2006.085", rows[2].value!, "-0.085", "L92 = 25.5 × 78.67 (CU redondeado a mano)");
    known("Kardex", "Costo de la salida de 24 kg", "Hoja2 I93", "1888.08", rows[3].cost!, "-0.08", "I93 = 24 × 78.67 (CU redondeado a mano)");
    check("Kardex", "Valor tras salir 24 kg", "Hoja2 L93", "118.005", rows[3].value!, TOTAL);
    check("Kardex", "Saldo tras la compra de 15 kg", "Hoja2 J94", "16.5", rows[4].quantity, TOTAL);
    check("Kardex", "Valor tras la compra de 15 kg", "Hoja2 L94", "1393.005", rows[4].value!, TOTAL);
    check("Kardex", "Promedio tras la compra de 15 kg", "Hoja2 K94", "84.42454545454547", rows[4].average!, PORTION);
  });
});

describe("Hoja1 · planilla (B4:K8)", () => {
  const base = { salary: "0", bonuses: "0", family_allowance: "0", gratification_july: "0", gratification_december: "0", cts_annual: "0", extraordinary_percent: "0", essalud_percent: "9", essalud_base: null, essalud_minimum_base: "0", sctr_percent: "0", sctr_base: null, eps_monthly: "0", eps_credit: "0", other: "0" };
  it.each([
    ["Cocinero", "1500", "1635", "K6"],
    ["Ayudante", "1200", "1308", "K7"],
    ["Lavaplatos", "1130", "1231.7", "K8"],
  ])("%s: sueldo + EsSalud 9 %%", (name, sueldo, total, cell) => {
    check("Planilla", `${name}: costo mensual`, `Hoja1 ${cell}`, total, monthlyPayroll({ ...base, salary: sueldo }).total, TOTAL);
  });

  it("Cheff: el Excel omite la CTS (H5) en el sueldo I5", () => {
    // C5 1800 básico, D5/E5 75 + 75 gratificaciones (1/24 anual cada una), F5 500 bonificación, G5 50 asig. fam,
    // H5 150 CTS. I5 = SUM(C5:G5) = 2500 (sin H5), J5 = 9 % de I5, K5 = 2725.
    const p = monthlyPayroll({ ...base, salary: "1800", bonuses: "500", family_allowance: "50", gratification_july: "900", gratification_december: "900", cts_annual: "1800", essalud_base: "2500" });
    known("Planilla", "Cheff: costo mensual", "Hoja1 K5", "2725", p.total, "150", "I5 = SUM(C5:G5) deja fuera la CTS H5 = 150");
    check("Planilla", "Cheff: EsSalud 9 % sobre 2500", "Hoja1 J5", "225", p.essaludGross, TOTAL);
  });
});

describe("Hoja1 · reparto de CIF (E12:H25)", () => {
  it("por valor de venta (G21:H24) y en partes iguales (G13:G16)", () => {
    const byValue = allocation("10", new Map([[1, "20"], [2, "2.5"], [3, "4.5"], [4, "0.2"]])); // H25 = 10; F21:F24
    check("Reparto", "Panetón (por valor)", "Hoja1 H21", "7.352941176470589", byValue.exact.get(1)!, TOTAL);
    check("Reparto", "Sublime (por valor)", "Hoja1 H22", "0.9191176470588236", byValue.exact.get(2)!, TOTAL);
    check("Reparto", "Helado (por valor)", "Hoja1 H23", "1.6544117647058822", byValue.exact.get(3)!, TOTAL);
    check("Reparto", "Caramelo (por valor)", "Hoja1 H24", "0.07352941176470588", byValue.exact.get(4)!, TOTAL);
    const equal = allocation("10", new Map([[1, "1"], [2, "1"], [3, "1"], [4, "1"]])); // H17 = 10 → G13:G16 = 2.5
    for (const [k, cell] of [[1, "G13"], [2, "G14"], [3, "G15"], [4, "G16"]] as const) check("Reparto", `Producto ${k} (iguales)`, `Hoja1 ${cell}`, "2.5", equal.exact.get(k)!, TOTAL);
  });
});
