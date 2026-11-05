# Integración del Excel de costos de restaurantes

## Tabla de plan de producción y selección inicial de platos

Se agrega una tabla independiente por escenario a la lista de planes y al detalle del plan, conservando las pantallas existentes. Cada plato tiene su propia fila: cantidad mensual, participación en cantidades, VV sin IGV, ventas y participación en ventas, costo completo por unidad y costos mensuales. Los costos completos proceden del motor compartido e incluyen CMP, MOD, CIF y gastos. El total mensual suma cantidad × costo completo; no suma costos unitarios. Se identifican aparte MOD no absorbida y gastos sin asignar para conciliar con el costo del periodo.

Nuevo plan permite seleccionar platos activos, cantidades mensuales, precio final con IGV y factor equivalente. Usa la receta actual y propone el precio guardado; si existe una línea del mismo mes propone su cantidad, factor y precio manual o adoptado disponible. Los campos pueden revisarse antes de guardar. No se inventan cantidades ni precios ausentes, ni se modifican escenarios anteriores. Plan y líneas se guardan juntos después de validar propiedad, duplicados y valores positivos. Se conserva la creación de borradores vacíos y la edición posterior. Verificación: 6 pruebas aprobadas de planificación y tabla de producción.

## Costo por minuto de trabajador

En **Costo total y precio de venta**, debajo del resumen por plato, se muestra una tabla independiente de personal, sueldo mensual total, tiempo total en minutos, productividad, tiempo efectivo y costo por minuto. Usa el mes del plan consultado o el periodo enviado en la ficha de cálculo; sin plan usa el mes activo del restaurante.

Los datos se leen de `Employee` y `EmployeePeriodCost`. Tiempo total = días × horas × 60; tiempo efectivo = (tiempo total − minutos excluidos) × productividad; tarifa = costo mensual total / tiempo efectivo. La tarifa se presenta a dos decimales y se conserva su valor exacto. Con tiempo efectivo cero no se divide ni se inventa una tarifa. Las configuraciones ausentes enlazan a «Completar datos mensuales». El registro de **Nuevo trabajador** ya solicita sueldo, días, horas, productividad y exclusiones, además del desglose laboral; no se duplican columnas ni datos de planilla. Verificación: 9 pruebas aprobadas de resumen por porción, alta de trabajadores y costo por minuto.

## Resumen de costo y precio de un plato

En **Costo total y precio de venta** se agregó una tabla con materia prima, MOD, CIF, administración, ventas, gastos financieros, otros gastos, costo total, ganancia, valor de venta sin IGV, IGV y precio final. Se muestra al consultar un plato de un plan guardado o al calcular la ficha de un escenario nuevo. Consultar el resumen no modifica datos.

Los importes corresponden a una unidad de salida de la receta: el motor ya divide CMP y MOD entre el rendimiento del lote; el resumen divide únicamente CIF y gastos asignados entre la cantidad mensual del plato. No vuelve a dividir CMP/MOD ni asigna todos los gastos mensuales a una sola porción. La ganancia se calcula desde el precio adoptado sin impuesto menos el costo completo. Los datos incompletos bloquean el total y el precio final, mostrando los motivos. Se mantiene el IGV configurado de restaurantes, sin copiar el 10 % de la imagen referencial. Verificación: 17 pruebas aprobadas del flujo de restaurantes y resumen por porción.

## Tablas separadas de CIF y gastos

El apartado contiene tres tablas independientes: **COSTOS INDIRECTOS DEL RESTAURANTE (FABRICACIÓN)**, **GASTOS ADMINISTRATIVOS** y **GASTOS DE VENTAS**. Se seleccionan periodo, plan y plato. Cada fila muestra importe mensual, porcentaje asignado, cantidad mensual, importe asignado y costo por plato, con un total por categoría. Los conceptos financieros u otros registrados se conservan en sus respectivas tablas adicionales.

El reparto usa las asignaciones del motor del plan: importe mensual × participación / cantidad. No se copia el porcentaje redondeado de la imagen ni se introduce otro reparto independiente. La parte indirecta del personal se incluye automáticamente una sola vez. Sin plan, cantidades o base de reparto, los valores pendientes aparecen como «—».

En **Nuevo concepto**, la clasificación incluye explícitamente costo indirecto de fabricación, gasto administrativo y gasto de ventas. Además de los campos existentes, se puede elegir un plato de un plan del mismo mes y completar su cantidad mensual, venta de referencia sin IGV y factor equivalente. Esos valores actualizan la línea del plan en la misma transacción; dejarlos vacíos conserva los datos actuales. La pantalla explica esta actualización antes de guardar. Los porcentajes se calculan automáticamente desde las bases de todos los destinatarios. No se requieren columnas nuevas ni migrar datos previos. Verificación: 20 pruebas de planificación, mejoras Excel y tablas separadas de gastos.

## Tabla de mano de obra en Personal

Se conserva la lista de trabajadores y las configuraciones mensuales. Debajo se agrega **Costos de mano de obra directa**, con selectores de mes y versión de receta, personal/cargo, sueldo mensual total, minutos del lote, tarifa por minuto, costo y total. La tarifa usa la precisión completa del cálculo; también se informa la MOD por porción. Los datos pendientes se señalan y bloquean el total en lugar de inventar un importe.

En **Nuevo trabajador** se añadieron la configuración mensual (componentes, beneficios, seguros, días, horas y productividad) y la asignación de minutos a un plato. Se guardan juntos en los modelos existentes `Employee`, `EmployeePeriodCost` y `RecipeWork`, sin migración ni modificación de registros previos. Puede mantenerse el registro básico y completar los costos después. La edición de trabajadores y las configuraciones mensuales anteriores siguen disponibles. Verificación de esta adición: 19 pruebas aprobadas de planificación, mejoras Excel y tabla de mano de obra.

Referencia: `2026 2 UNI CCP COSTOS DE RESTAURANTES.xlsx`. Se analizaron las tres hojas por nombre, aunque el orden físico del libro es Hoja2, Hoja3, Hoja1. El Excel original se conserva intacto.

## Cambios disponibles en la página

1. **Mano de obra directa → Costo mensual**: desglose de sueldo, bonificaciones, asignación familiar, gratificaciones, CTS, EsSalud, SCTR y EPS. Se muestra el total mensual y la tarifa por minuto. Las configuraciones anteriores siguen en modo consolidado hasta que se cambien expresamente.
2. **Platos y recetas → Operaciones**: cada actividad vincula un trabajador y minutos por lote; el motor obtiene su tarifa del mes y calcula CMOD por porción. No duplica sueldos indirectos como gastos adicionales.
3. **Ingredientes**: las nuevas entradas proponen cantidad neta y merma. Se conservan los modos históricos de cantidad bruta y consumo adicional. La equivalencia g/kg o ml/l es exacta; unidades/peso o atado/peso requieren una equivalencia específica del insumo.
4. **CIF y gastos**: se agregó Gastos financieros (GF), además de CIF, administración y ventas. Intereses y comisiones se clasifican como GF; el principal de un préstamo no es un gasto.
5. **Costo total y precio / Plan de Producción**: nuevo modo Food Cost objetivo sobre costo total. Introducir `30` significa 30 %. Se muestra precio sugerido, precio adoptado, impuesto y proporción efectiva del costo sobre venta neta.

## Comparación con el prototipo

| Referencia | Hallazgo | Tratamiento |
| --- | --- | --- |
| Hoja1 C5:K5 | I5 suma C5:G5, omitiendo CTS H5=150; K5 resulta 2725 | CTS sí participa en el total. Con los mismos componentes y base EsSalud explícita de 2500, el costo es 2875. No se modificaron planillas reales para imponer los ejemplos del Excel. |
| Hoja1 D5 y H11 | El prototipo mezcla provisiones y referencias como sueldo/24 y sueldo/12 | Se ingresan importes anuales previstos de julio, diciembre y CTS; cada uno se divide entre 12. No se supone un régimen laboral ni se suma de nuevo el pago. |
| Hoja2 D58:G61 | Minutos = 26 × 8 × 60; luego productividad | Días, horas, exclusiones y productividad quedan guardados por trabajador y mes. 2725 / 11232 reproduce la tarifa de G58. |
| Hoja2 C14:G23 | Conversiones g/kg, unidades/kg y atados/g mezcladas; G19 omite el precio y G23 tiene un importe manual inconsistente | Conversión dimensional estricta o equivalencia documentada por insumo; no se deducen pesos de un limón o atado sin evidencia. |
| Hoja2 U32:U53 | Divisiones por cero y datos incompletos | Se conservan estados de cálculo incompleto, sin presentar una utilidad definitiva ni publicar un presupuesto incompleto. |
| Hoja2 G52, N52 | Tasas de 10 % y 18 % mezcladas | Se mantiene el IGV de restaurante de 18 % establecido en la configuración anterior del proyecto. El servicio puro admite tasas explícitas entre 0 y 100 %. |
| Hoja2 G49:G53 | Precio desde costo más ganancia nominal | Se conserva el precio manual, margen y recargo; se agrega el objetivo solicitado basado en costo completo. |

El bloque de kardex Hoja2 C88:L94 muestra precios de referencia ponderados, pero no se importaron movimientos de inventario ficticios: los precios continúan versionados, con costo de adquisición, fecha y fuente. Las mejoras solicitadas se integran al motor existente.

## Esquemas y campos

La aplicación utiliza **Flask y SQLAlchemy con Alembic**, no Prisma/Mongoose. La base local existente conserva usuarios, restaurantes, personal, planes y presupuestos; el catálogo externo y los platos sincronizados se mantienen en SQL Server.

Migración `f19c2026a004`, posterior a `e8bc410aa003`:

- `employee_period_costs.breakdown`, JSON nullable: entradas explícitas, bases aplicadas, componentes y total. `NULL` significa planilla histórica consolidada, cuya composición no se inventa. `data` mantiene los componentes mensuales consumidos por el motor, tiempo y distribución.
- `CostConcept.kind` admite `finance`; `PlanLine.pricing_mode` admite `food_cost` y `pricing_value` almacena la proporción (0,30). Sus columnas existentes ya soportan estos valores.
- `RecipeLine.mode` y `rate` ya almacenan la merma por ingrediente y versión de receta. No se agrega otra columna que pueda contradecir el porcentaje existente. `RecipeWork.operations` ya almacena trabajador, actividad y minutos.
- `dbo.platos.especificaciones` pasa a `schema_version=2`: conserva receta, merma, rendimiento utilizable y conversión, e incluye la planilla detallada y conceptos de cada plan que costea el plato. Sigue siendo JSON válido en la tabla del archivo `../cevicheria_costos_completo.sql`; no requiere alterar las tablas originales del catálogo.

Campos añadidos al desglose y su motivo:

| Campos | Motivo |
| --- | --- |
| `salary`, `bonuses`, `family_allowance` | Separar remuneración, bonificaciones y asignación familiar, evitando inferir importes. |
| `gratification_july`, `gratification_december`, `cts_annual` | Presupuestar las prestaciones anuales y distribuirlas una sola vez entre 12 meses. |
| `extraordinary_percent` | Incluir la bonificación extraordinaria de gratificaciones sin confundirla con EsSalud. |
| `essalud_percent`, `essalud_base`, `essalud_minimum_base` | Calcular una carga sobre una base explícita y un mínimo aplicable. La base vacía usa sueldo + bonos + asignación familiar, sin sumar provisiones automáticamente. |
| `sctr_percent`, `sctr_base` | Usar la tasa y base del seguro contratado; cero cuando no aplica. |
| `eps_monthly`, `eps_credit` | Sumar la prima patronal y descontar solo el crédito que corresponda contra EsSalud. El crédito no puede exceder ni EsSalud bruto ni la prima ingresada. |
| `other` | Otros costos mensuales sustentados sin forzarlos dentro de otro beneficio. |
| `days`, `hours`, `excluded`, `productive` (ya existentes) | Obtener capacidad real; se proponen 26 días y 8 horas para nuevas configuraciones, editables. |

Las tasas e importes son parámetros de un presupuesto de costos. No se deduce la elegibilidad de beneficios a partir del cargo. EsSalud se propone en 9 %, y la bonificación extraordinaria queda editable. Referencias consultadas: [EsSalud/SUNAT, tasa y base mínima](https://orientacion.sunat.gob.pe/08-calculo-de-los-aportes), [SUNAFIL, bonificación extraordinaria y EPS](https://www.gob.pe/institucion/sunafil/noticias/676065-calcula-tu-grati-aplicativo-de-la-sunafil-ya-ha-resuelto-mas-de-110-000-consultas-desde-su-lanzamiento-en-2021).

## Funciones y fórmulas

- `services/payroll.py::monthly_payroll`: suma sueldo + bonos + asignación + julio/12 + diciembre/12 + CTS/12 + bonificación extraordinaria + EsSalud neto + SCTR + EPS + otros. Usa Decimal y rechaza importes no finitos, negativos, tasas inválidas y campos obligatorios ausentes.
- `services/costing.py::labor_cost`: minutos efectivos = (días × horas × 60 − exclusiones) × productividad. Tarifa MOD = costo asignado a MOD / minutos asignados a MOD. Sin minutos disponibles no inventa una tarifa cero. `calculate_plan` multiplica por minutos de cada operación y divide entre el rendimiento del lote.
- `services/units.py::convert_quantity` y `services/recipes.py::calculate_line`: cantidad base = cantidad × conversión; si es neta, compra bruta = cantidad base / (1 − merma); CMP = compra bruta × costo base. Con 250 g netos, 20 % de merma y S/80/kg: compra 0,3125 kg, costo S/25, costo utilizable S/100/kg. Merma de 100 % se rechaza.
- `services/costing.py::calculate_plan`: producción = CMP + CMOD + CIF; costo completo = producción + GAD + GV + GF + otros. Los importes mensuales se distribuyen mediante la base seleccionada y se concilian, sin sumar dos veces los gastos.
- `services/costing.py::price(..., mode="food_cost", ...)`: precio neto sugerido = costo completo / objetivo; precio final = neto × (1 + impuesto). Objetivo válido: mayor que 0 y hasta 100 %. Costo S/12, objetivo 30 %, IGV 18 % → neto S/40, IGV S/7,20, final S/47,20. Si se adopta otro precio se recalcula la proporción efectiva.

El término Food Cost de esta opción se aplica al **costo total**, como solicita el prompt; no se confunde con el indicador habitual basado únicamente en materia prima. El resultado posterior a gastos financieros se identifica como resultado antes del impuesto a la renta.

## Verificación y despliegue

Pruebas: comparación con celdas del Excel, CTS omitida, EsSalud/EPS/SCTR, minutos disponibles, conversión kg/g, merma, precio objetivo, GF sin doble cargo, historial de presupuestos, aislamiento entre restaurantes, CSRF y guardado SQL de las especificaciones.

La migración se ensaya sobre una copia antes de aplicarse. La comprobación compara todas las filas y columnas previas para asegurar que sus valores no cambien. Los respaldos se guardan en `.artifacts/backups`. El servidor sigue administrado por la tarea automática `Costea-Servidor-Local`.

La prueba real de SQL Server incluyó planilla detallada, gastos financieros y precio Food Cost dentro de una transacción revertida al terminar. La migración histórica conservó los valores anteriores. El módulo de plan de negocio fue retirado del código activo; la migración que creó su tabla se conserva por compatibilidad con bases ya migradas.
