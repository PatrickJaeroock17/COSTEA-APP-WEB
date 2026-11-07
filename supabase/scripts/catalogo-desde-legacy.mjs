// Genera supabase/migrations/*_catalogo_datos.sql a partir de legacy/Costea-main/cevicheria_costos_completo.sql.
//
// No traduce el T-SQL a mano: extrae las filas de cada INSERT ... VALUES y reproduce lo que hace el script:
//   1. Catálogo: categorías, unidades e insumos.
//   5. 20 platos y sus recetas; cada línea se une al insumo por nombre + variedad sin distinguir
//      mayúsculas ni tildes (COLLATE Latin1_General_CI_AI) y por unidad (ml/l → Litro; el resto → kg).
//   6. Revisión de precios por nombre + variedad + unidad (todas las filas deben coincidir).
//   7. Stock inicial de apertura: consumo diario bruto × días de cobertura × (1 + reserva),
//      redondeado hacia arriba al paso de compra y con el mínimo operativo.
//   8. Personal simulado y parámetros laborales.
// Cualquier discrepancia detiene el proceso (como los THROW del original).
//
// Uso: node supabase/scripts/catalogo-desde-legacy.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Decimal from "decimal.js";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE = path.join(root, "legacy/Costea-main/cevicheria_costos_completo.sql");
const OUT = path.join(root, "supabase/migrations/20261107150300_catalogo_datos.sql");
const sql = fs.readFileSync(SOURCE, "utf8");

const fail = (msg) => {
  console.error("ERROR:", msg);
  process.exit(1);
};

// ───────────── Lectura de INSERT ... VALUES ─────────────

function skipSpaceAndComments(s, i) {
  for (;;) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (s.startsWith("--", i)) {
      while (i < s.length && s[i] !== "\n") i++;
      continue;
    }
    return i;
  }
}

function readValue(s, i) {
  if (s[i] === "N" && s[i + 1] === "'") i++;
  if (s[i] === "'") {
    let out = "";
    i++;
    for (;;) {
      if (i >= s.length) fail("cadena sin cerrar");
      if (s[i] === "'") {
        if (s[i + 1] === "'") {
          out += "'";
          i += 2;
          continue;
        }
        return [{ s: out }, i + 1];
      }
      out += s[i++];
    }
  }
  const m = /^(NULL|-?\d+(?:\.\d+)?)/i.exec(s.slice(i, i + 40));
  if (!m) fail(`valor no reconocido cerca de: ${s.slice(i, i + 60)}`);
  return [m[1].toUpperCase() === "NULL" ? null : { n: m[1] }, i + m[1].length];
}

/** Todas las filas insertadas en `target` (p. ej. "dbo.insumos" o "@receta"), en orden. */
function rowsOf(target) {
  const esc = target.replace(/[.@]/g, (c) => `\\${c}`);
  const re = new RegExp(`INSERT\\s+INTO\\s+${esc}\\s*\\(([^)]*)\\)\\s*VALUES`, "gi");
  const rows = [];
  let cols = null;
  for (const m of sql.matchAll(re)) {
    const c = m[1].split(",").map((x) => x.trim());
    if (cols && cols.join() !== c.join()) fail(`${target}: columnas distintas entre sentencias`);
    cols = c;
    let i = m.index + m[0].length;
    for (;;) {
      i = skipSpaceAndComments(sql, i);
      if (sql[i] !== "(") fail(`${target}: se esperaba "("`);
      i++;
      const row = [];
      for (;;) {
        i = skipSpaceAndComments(sql, i);
        let v;
        [v, i] = readValue(sql, i);
        row.push(v);
        i = skipSpaceAndComments(sql, i);
        if (sql[i] === ",") {
          i++;
          continue;
        }
        if (sql[i] === ")") {
          i++;
          break;
        }
        fail(`${target}: separador inesperado "${sql[i]}"`);
      }
      if (row.length !== cols.length) fail(`${target}: fila con ${row.length} valores para ${cols.length} columnas`);
      rows.push(Object.fromEntries(cols.map((k, j) => [k, row[j]])));
      i = skipSpaceAndComments(sql, i);
      if (sql[i] === ",") {
        i++;
        continue;
      }
      break;
    }
  }
  if (!cols) fail(`no se encontró INSERT INTO ${target}`);
  return rows;
}

const str = (v) => (v === null ? null : "s" in v ? v.s : v.n);
const num = (v) => new Decimal(str(v));
const fold = (x) => (x ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase(); // CI_AI
const ci = (x) => (x ?? "").toLowerCase(); // CI_AS (collation por defecto)
const expect = (cond, msg) => cond || fail(msg);

// ───────────── 1. Catálogo ─────────────

const categorias = rowsOf("dbo.categorias");
const unidades = rowsOf("dbo.unidades_medida");
const insumos = rowsOf("dbo.insumos");
expect(categorias.length === 9, `categorías: ${categorias.length}, se esperaban 9`);
expect(unidades.length === 2, `unidades: ${unidades.length}, se esperaban 2`);
expect(insumos.length === 500, `insumos: ${insumos.length}, se esperaban 500`);

const unidadCodigo = new Map(unidades.map((u) => [str(u.id_unidad), str(u.codigo)]));
const insumo = insumos.map((r) => ({
  id: str(r.id_insumo),
  nombre: str(r.nombre),
  variedad: str(r.variedad),
  id_categoria: str(r.id_categoria),
  id_unidad: str(r.id_unidad),
  unidad: unidadCodigo.get(str(r.id_unidad)),
  precio: num(r.precio_mayorista),
  activo: str(r.activo) === "1",
  criterio: null,
  referencia: null,
  stock: null,
}));
expect(new Set(insumo.map((i) => i.id)).size === 500, "ids de insumo repetidos");

// ───────────── 6. Revisión de precios ─────────────

const revision = rowsOf("@precios_revision");
let cambios = 0;
for (const p of revision) {
  const hits = insumo.filter(
    (i) => ci(i.nombre) === ci(str(p.nombre)) && ci(i.variedad) === ci(str(p.variedad)) && i.unidad === str(p.unidad_base),
  );
  expect(hits.length === 1, `revisión sin coincidencia única: ${str(p.nombre)} / ${str(p.variedad)} (${hits.length})`);
  const i = hits[0];
  if (!i.precio.eq(num(p.precio))) cambios++;
  i.precio = num(p.precio);
  i.criterio = str(p.criterio);
  i.referencia = str(p.referencia);
}

// ───────────── 5. Platos y recetas ─────────────

const platos = rowsOf("@platos");
const receta = rowsOf("@receta");
expect(platos.length === 20, `platos: ${platos.length}, se esperaban 20`);
const lineas = receta.map((r) => {
  const unidad = ["ml", "l"].includes(str(r.unidad_receta)) ? "Litro" : "kg";
  const hits = insumo.filter(
    (i) => fold(i.nombre) === fold(str(r.insumo)) && fold(i.variedad) === fold(str(r.variedad)) && i.unidad === unidad,
  );
  expect(hits.length === 1, `receta ${str(r.id_plato_local)}/${str(r.orden)}: insumo ${str(r.insumo)} ${str(r.variedad)} (${hits.length} coincidencias)`);
  return {
    id_plato: str(r.id_plato_local),
    id_insumo: hits[0].id,
    orden: str(r.orden),
    cantidad: num(r.cantidad),
    unidad_receta: str(r.unidad_receta),
    factor: num(r.factor_a_unidad_base),
    merma: num(r.merma_pct),
  };
});
for (const p of platos) {
  expect(lineas.some((l) => l.id_plato === str(p.id_plato_local)), `plato ${str(p.id_plato_local)} sin receta`);
}

// ───────────── 7. Stock inicial de apertura ─────────────

const COMENSALES = new Decimal(60);
const RESERVA_PCT = new Decimal(10);
const factorComensales = COMENSALES.div(60);
const menu = new Map(rowsOf("@menu_apertura").map((m) => [str(m.id_plato_local), num(m.pedidos_dia_base)]));
expect(menu.size === 20, "menú de apertura incompleto");
const politicas = rowsOf("@politicas_apertura").map((a) => ({
  key: `${str(a.nombre)}|${str(a.variedad)}|${str(a.unidad_base)}`,
  dias: num(a.dias_cobertura),
  paso: num(a.paso_compra),
  minimo: num(a.minimo_base),
}));
const politicaDe = (i) => politicas.find((a) => ci(a.key) === ci(`${i.nombre}|${i.variedad}|${i.unidad}`));
for (const a of politicas) {
  expect(insumo.some((i) => ci(a.key) === ci(`${i.nombre}|${i.variedad}|${i.unidad}`)), `política sin insumo: ${a.key}`);
}

// Pedidos son recetas completas: no se divide por porciones.
const consumo = new Map();
for (const l of lineas) {
  const pedidos = menu.get(l.id_plato);
  if (!pedidos) continue;
  const cantidadBase = l.cantidad.times(l.factor).toDecimalPlaces(6);
  const bruto = cantidadBase.div(new Decimal(1).minus(l.merma.div(100))).times(pedidos).times(factorComensales);
  consumo.set(l.id_insumo, (consumo.get(l.id_insumo) ?? new Decimal(0)).plus(bruto));
}
for (const [id] of consumo) {
  const i = insumo.find((x) => x.id === id);
  expect(politicaDe(i), `insumo de receta sin política de apertura: ${i.nombre} ${i.variedad}`);
}
for (const i of insumo) {
  const a = politicaDe(i);
  if (!a) {
    i.stock = new Decimal(0);
    continue;
  }
  const diario = (consumo.get(i.id) ?? new Decimal(0)).toDecimalPlaces(6);
  const necesidad = diario.times(a.dias).times(new Decimal(1).plus(RESERVA_PCT.div(100)));
  const minimo = a.minimo.times(factorComensales);
  const base = necesidad.gt(minimo) ? necesidad : minimo;
  i.stock = base.div(a.paso).ceil().times(a.paso).toDecimalPlaces(3);
}
const conStock = insumo.filter((i) => i.stock.gt(0)).length;

// ───────────── 8. Personal ─────────────

const laborTables = [
  ["dbo.parametros_laborales", "catalogo_parametros_laborales"],
  ["dbo.areas_personal", "catalogo_areas_personal"],
  ["dbo.trabajadores", "catalogo_trabajadores"],
  ["dbo.contratos_personal", "catalogo_contratos_personal"],
  ["dbo.hijos_personal", "catalogo_hijos_personal"],
  ["dbo.beneficios_personal", "catalogo_beneficios_personal"],
  ["dbo.jornadas_personal", "catalogo_jornadas_personal"],
  ["dbo.calendario_laboral", "catalogo_calendario_laboral"],
  ["dbo.vacaciones_personal", "catalogo_vacaciones_personal"],
];
const BOOL = new Set([
  "activo", "es_simulado", "trabaja_feriados", "tiene_suspension_cuarta", "cursa_superiores", "acreditado",
  "escolaridad_simulada", "es_feriado",
]);

// ───────────── Salida SQL ─────────────

const lit = (v) => (v === null || v === undefined ? "null" : typeof v === "string" ? `'${v.replace(/'/g, "''")}'` : String(v));
const insert = (table, cols, rows) =>
  rows.length
    ? `insert into public.${table} (${cols.join(", ")}) values\n` + rows.map((r) => `  (${r.map(lit).join(", ")})`).join(",\n") + ";\n"
    : "";

let out = `-- Costea · Datos del catálogo base. ARCHIVO GENERADO: no editar a mano.
-- Origen: legacy/Costea-main/cevicheria_costos_completo.sql
-- Generador: supabase/scripts/catalogo-desde-legacy.mjs
-- Resumen: ${insumo.length} insumos (${cambios} precios revisados en la sección 6), ${platos.length} platos,
-- ${lineas.length} líneas de receta, ${conStock} insumos con stock de apertura (sección 7).

`;
out += insert("catalogo_categorias", ["id_categoria", "nombre"], categorias.map((c) => [Number(str(c.id_categoria)), str(c.nombre)]));
out += insert("catalogo_unidades_medida", ["id_unidad", "codigo", "descripcion"], unidades.map((u) => [Number(str(u.id_unidad)), str(u.codigo), str(u.descripcion)]));
out += insert(
  "catalogo_insumos",
  ["id_insumo", "nombre", "variedad", "id_categoria", "id_unidad", "precio_mayorista", "activo", "stock_inicial", "criterio_precio", "referencia_precio"],
  insumo.map((i) => [Number(i.id), i.nombre, i.variedad, i.id_categoria === null ? null : Number(i.id_categoria), Number(i.id_unidad), i.precio.toFixed(2), i.activo, i.stock.toFixed(3), i.criterio, i.referencia]),
);
out += insert(
  "catalogo_platos",
  ["id_plato", "nombre", "descripcion", "porciones", "categoria_menu"],
  platos.map((p) => [Number(str(p.id_plato_local)), str(p.nombre), str(p.descripcion), num(p.porciones).toString(), str(p.categoria_menu)]),
);
out += insert(
  "catalogo_receta_detalles",
  ["id_plato", "id_insumo", "orden", "cantidad", "unidad_receta", "factor_a_unidad_base", "merma_pct"],
  lineas.map((l) => [Number(l.id_plato), Number(l.id_insumo), Number(l.orden), l.cantidad.toString(), l.unidad_receta, l.factor.toString(), l.merma.toFixed(2)]),
);

const laborCounts = [];
for (const [source, table] of laborTables) {
  const rows = rowsOf(source);
  const cols = Object.keys(rows[0]);
  const keys = cols.map((c) => c);
  out += insert(
    table,
    cols,
    rows.map((r) => keys.map((k) => (r[k] === null ? null : BOOL.has(k) ? str(r[k]) === "1" : "s" in r[k] ? r[k].s : r[k].n))),
  );
  laborCounts.push(`${table}: ${rows.length}`);
}

// Los números van como literales entre comillas: PostgreSQL los convierte exactos al tipo numeric de la columna.
fs.writeFileSync(OUT, out, "utf8");
console.log(`Escrito ${path.relative(root, OUT)}`);
console.log(`insumos ${insumo.length} · precios revisados ${cambios} de ${revision.length} · platos ${platos.length} · líneas ${lineas.length} · con stock ${conStock}`);
console.log(laborCounts.join(" · "));
