# Prompt maestro — Sistema multiempresa de costos y presupuestos

Versión revisada: 20 de septiembre de 2026.

Este documento reemplaza el prompt original para el desarrollo futuro. Su lectura o revisión no autoriza por sí sola a implementar la aplicación. Ejecuta la primera tarea únicamente cuando el usuario solicite iniciar el desarrollo.

## 1. Objetivo y alcance

Actúa como ingeniero full-stack senior con conocimientos de modelado de costos. Diseña una aplicación web responsive, modular, segura y mantenible para el curso de Contabilidad de Costos y Presupuestos.

Permite que un usuario administre varias empresas de los rubros textil, muebles, imprenta y restaurantes. Usa un solo motor de costos, extensible mediante configuración. El rubro cambia terminología, categorías, unidades sugeridas y ejemplos; no introduce fórmulas especiales mediante condicionales por sector.

La versión 1.0 calcula costos estándar o estimados y presupuestos mensuales. No presenta estas estimaciones como costos reales ni como estados financieros oficiales. Conserva separadas las dimensiones empresa, periodo, plan y versión.

Referencia conceptual: `2026 2 UNI CCP COSTOS DE RESTAURANTES.xlsx`. No transcribas sus fórmulas sin comprobar unidades, referencias y significado.

Prioridades: corrección de cálculos, integridad de datos, trazabilidad, mantenibilidad, experiencia de usuario y apariencia.

## 2. Decisiones del modelo inicial

- Un periodo es un mes calendario identificado por año y mes.
- Cada empresa opera en una moneda. No convertir ni sumar monedas diferentes.
- Un plan contiene cantidades de productos terminados buenos. En la versión 1.0 se supone producción igual a ventas del periodo, sin inventario inicial/final ni productos en proceso. Mostrar este supuesto al usuario. Una planificación que necesite cantidades distintas requiere ampliar el modelo antes de calcular utilidad.
- Los costos de materiales son precios de referencia vigentes seleccionados para el plan; no provienen de un kardex automático.
- Las recetas y operaciones se definen por lote base y se convierten a la unidad de producto.
- Los presupuestos publicados conservan una copia inmutable de sus datos y resultados. Cambiar precios del catálogo no altera presupuestos anteriores.
- CIF y gastos se distribuyen con bases explícitas. No suponer que todos los productos consumen los mismos recursos.
- La asignación completa de costos del periodo de esta versión es una herramienta gerencial para presupuestar y fijar precios. No afirmar que es una valoración de inventarios conforme a NIC 2. La capacidad normal y el tratamiento de CIF fijos no absorbidos para inventarios pertenecen a una ampliación posterior.

## 3. Convenciones numéricas y estados de cálculo

Usar `Decimal` desde la entrada hasta la salida, creado desde cadenas; no convertir primero a `float`. Persistir valores con precisión decimal suficiente y probar su ida y vuelta en SQLite y PostgreSQL. Si SQLite no garantiza la precisión requerida mediante el ORM, usar texto decimal canónico o enteros escalados con un tipo de persistencia documentado.

- Porcentajes en pantalla: 20 %. Tasas en servicios y almacenamiento: `0.20`. Convertir una sola vez en el límite de entrada.
- Cantidades, factores y tasas: conservar al menos 6 decimales cuando sea necesario. Contexto decimal de cálculo: 28 dígitos.
- Importes finales: 2 decimales para PEN, con `ROUND_HALF_UP`. Parametrizar la precisión monetaria por moneda.
- No redondear costos por minuto, conversiones o costos unitarios antes de multiplicar cantidades.
- Guardar resultado de precisión completa y resultado presentado cuando corresponda.
- `None` significa dato faltante, no cero. Un cero debe ser explícito y válido para el concepto.
- Estados: `calculable`, `incompleto`, `sin_base_asignacion` y `capacidad_excedida`. Acompañar cada estado con la causa concreta.
- Nunca devolver cero para ocultar una división por cero o un dato requerido ausente. Conservar el costo conocido y mostrar qué parte no puede asignarse.
- Un producto sin materiales o sin MOD puede ser válido solo si el usuario indica expresamente que ese componente no aplica.

## 4. Materiales, unidades y costo de adquisición

Cada material tiene código único por empresa, nombre, categoría, unidad base, proveedor opcional, estado y versiones de costo con vigencia.

Registrar por versión: cantidad adquirida, unidad de compra, factor a unidad base, importe neto después de descuentos, impuesto no recuperable y costos atribuibles de adquisición no incluidos previamente. El sistema también puede aceptar un costo unitario de referencia ingresado directamente, con fecha y origen; los dos modos son excluyentes.

```text
cantidad_base_compra = cantidad_compra × factor_compra_a_base
costo_adquisicion = importe_neto + impuesto_no_recuperable + costos_atribuibles
costo_por_unidad_base = costo_adquisicion / cantidad_base_compra
```

La cantidad base de compra debe ser mayor que cero. Los costos atribuibles no pueden volver a registrarse como CIF o gasto del mismo plan.

El impuesto recuperable se conserva separado del costo. Su recuperabilidad es un dato configurado y sustentado por el usuario, no una conclusión automática del sistema. No construir un motor tributario en esta versión.

Conversiones universales permitidas: kg ↔ g, litro ↔ ml, hora ↔ minuto, millar ↔ unidad. Usar factores exactos y validar dimensiones.

Conversiones como atado ↔ gramos, limón ↔ kg, tela en metros ↔ m² o litros ↔ kg requieren un factor específico documentado para el material. No inventar pesos, densidades ni rendimientos. Guardar cantidad y unidad en campos separados; rechazar textos como `200 g` en campos numéricos.

## 5. Productos, recetas, lotes y mermas

Producto: empresa, código, nombre, descripción, unidad de producto, cantidad de salida del lote base, estado y versión de receta. La salida del lote debe ser mayor que cero.

Ejemplos: un plato, un polo, un escritorio o un volante. Una receta de imprenta puede producir 1 000 volantes; si la unidad comercial es millar, convertirla explícitamente a la unidad base antes de calcular. No mezclar costo por volante con precio por millar.

Cada línea de receta registra material, cantidad, unidad de consumo y modo de cantidad:

1. `bruta`: la cantidad ya expresa la entrada comprada a consumir. No aplicar una merma adicional.
2. `neta_con_perdida`: la cantidad expresa material útil requerido y la merma es la fracción perdida de la entrada bruta.
3. `neta_con_adicional`: la cantidad expresa una necesidad teórica más un adicional porcentual sobre esa necesidad.

```text
q_base = cantidad_receta × factor_consumo_a_base
modo bruta:              q_bruta = q_base
modo neta_con_perdida:    q_bruta = q_base / (1 - merma)
modo neta_con_adicional:  q_bruta = q_base × (1 + adicional)

costo_linea_lote = q_bruta × costo_por_unidad_base
CMP_lote = suma(costo_linea_lote)
CMP_unitario = CMP_lote / salida_buena_lote
CMP_plan_producto = CMP_unitario × cantidad_planificada
```

Exigir `0 ≤ merma < 1` y `adicional ≥ 0`. Los modos son excluyentes. Diferenciar en la interfaz «pérdida sobre entrada» y «adicional sobre necesidad». No descontar dos veces una pérdida ya incorporada al rendimiento del lote.

La versión 1.0 admite consumo proporcional de recetas. No simular automáticamente lotes enteros, sobrantes ni tiempos de preparación por corrida. Si el proceso necesita esas restricciones, marcarlas como no soportadas y documentar la ampliación.

## 6. Personal y costo laboral

Registrar nombre, documento opcional, cargo y distribución del costo entre MOD, CIF, administración y ventas. Las fracciones suman 100 %. Un trabajador totalmente directo tiene fracción MOD igual a 1.

Registrar componentes mensuales del costo del empleador: remuneración, asignaciones, provisiones de beneficios y cargas patronales. Cada componente tiene nombre, importe mensual, vigencia y origen de cálculo. En la primera versión se ingresan importes mensuales explícitos; no codificar tasas legales ni reglas laborales por defecto.

Una gratificación anual o semestral debe convertirse a su provisión mensual según una regla explícita antes de sumarla. No sumar simultáneamente provisión y pago del mismo beneficio. No sumar retenciones del trabajador como si fueran costos adicionales del empleador.

```text
costo_laboral_mes = suma(componentes_mensuales)
minutos_programados = dias_programados × horas_dia × 60
minutos_disponibles = minutos_programados - minutos_excluidos
minutos_efectivos = minutos_disponibles × factor_productivo

costo_MOD_disponible = costo_laboral_mes × fraccion_MOD
minutos_MOD_disponibles = minutos_efectivos × fraccion_MOD
costo_minuto_MOD = costo_MOD_disponible / minutos_MOD_disponibles
```

El modelo inicial supone que la distribución del costo laboral coincide con la distribución de tiempo por función. Mostrar ese supuesto. Si se requiere una distribución diferente, modelar ambas explícitamente antes de usarla.

Exigir días y horas no negativos, `0 ≤ minutos_excluidos ≤ minutos_programados` y `0 ≤ factor_productivo ≤ 1`. Las exclusiones representan tiempo retirado de la jornada; el factor representa eficiencia sobre el tiempo restante. No descontar la misma pausa o ausencia en ambos lugares.

Con fracción MOD cero no corresponde calcular tarifa MOD. Con costo MOD positivo y minutos efectivos cero, el costo por minuto queda no calculable y el importe queda pendiente de absorción. No reemplazarlo por cero.

## 7. Mano de obra directa y capacidad

Cada operación de receta vincula trabajador, actividad y minutos efectivos estándar por lote. En la versión 1.0 usar trabajadores individuales; los grupos homogéneos de recursos quedan para una ampliación.

```text
CMOD_lote = suma(minutos_operacion_lote × costo_minuto_MOD_trabajador)
CMOD_unitario = CMOD_lote / salida_buena_lote
minutos_requeridos_trabajador_plan = suma(
    minutos_trabajador_lote / salida_buena_lote × cantidad_planificada
)
CMOD_asignada_trabajador = minutos_requeridos_trabajador_plan × tarifa_trabajador
MOD_no_absorbida = costo_MOD_disponible - CMOD_asignada_trabajador
```

Comparar minutos requeridos y disponibles por trabajador. Si la demanda supera la capacidad, mostrar el exceso y bloquear la publicación del presupuesto hasta ajustar cantidades, capacidad o costos de recursos. No inventar horas extra gratuitas ni permitir MOD no absorbida negativa en un presupuesto publicado.

Si existe capacidad ociosa, presentar la MOD no absorbida como costo del periodo en la conciliación y en la utilidad proyectada. No sumar de nuevo toda la nómina a CMOD.

La parte de nómina asignada a CIF o gastos genera registros enlazados de origen único. La suma de todas las clasificaciones debe conciliar con la nómina mensual.

## 8. CIF y bases de distribución

Cada concepto registra empresa, periodo, descripción, importe presupuestado, comportamiento fijo/variable, origen, productos destinatarios y base de asignación. La distinción fijo/variable es descriptiva en la primera versión; cambiar producción no recalcula automáticamente los importes presupuestados.

Solo incluir recursos de producción. Alquiler, servicios y personal compartidos se separan entre funciones mediante porcentajes documentados que sumen 100 %. La clasificación depende de la función, no solo del nombre del cargo. No clasificar automáticamente a todos los mozos o a todo el alquiler como CIF.

Implementar en la versión 1.0 estas bases mediante una función común:

- Unidades equivalentes: `b_i = cantidad_i × factor_equivalencia_i`. Usar factor 1 solo cuando las unidades sean comparables; no distribuir indistintamente entre volantes, millares y escritorios.
- Minutos MOD: `b_i = cantidad_i × minutos_MOD_unitarios_i`.
- Ventas de referencia sin impuesto: `b_i = cantidad_i × valor_venta_referencia_i`. Es una opción gerencial para reproducir el criterio del Excel, no una medida automática de consumo de recursos. Guardar la justificación.

```text
B = suma(b_i de productos destinatarios)
CIF_asignado_i = importe_CIF × b_i / B
CIF_unitario_i = CIF_asignado_i / cantidad_i
```

Calcular por concepto y después sumar por producto. Productos con cantidad cero no reciben costos ni tienen costo unitario completo del plan.

Si `B = 0` y el importe es positivo, conservar el importe como no asignado y el cálculo como pendiente. Si el importe es cero, la asignación total es cero. No cambiar de base silenciosamente.

Los precios de referencia usados para distribuir no pueden ser los precios sugeridos calculados en la misma pasada. Deben fijarse como entradas independientes para evitar la circularidad precio → distribución → costo → precio.

Conciliación obligatoria por concepto: `importe = asignado + no_asignado`. Para presentación en céntimos, repartir diferencias de redondeo por mayores restos, con desempate por identificador estable. Nunca perder ni crear céntimos.

## 9. Gastos y costo gerencial completo

Clasificar gastos administrativos, de ventas y otros operativos por separado del costo de producción. Usar las mismas bases explícitas de distribución y conciliación de CIF. No capitalizar estos gastos en el costo de producción.

```text
costo_produccion_unitario_i = CMP_unitario_i + CMOD_unitario_i + CIF_unitario_i
gasto_asignado_unitario_i = gastos_asignados_i / cantidad_i
costo_completo_unitario_i = costo_produccion_unitario_i + gasto_asignado_unitario_i
```

Llamar al último resultado «Costo completo gerencial para fijación de precios». No presentarlo como costo contable de inventario. La MOD no absorbida se muestra separadamente; no está incluida en ese costo unitario salvo que una futura política explícita la distribuya sin duplicarla.

La versión 1.0 ingresa gastos como montos del periodo. Comisiones dependientes del precio y cargos porcentuales de plataformas quedan fuera del cálculo automático inicial, porque requieren una ecuación de precio adicional. No sustituirlos silenciosamente por porcentajes del costo.

## 10. Precio, recargo, margen e impuesto

Definir `C` como costo completo unitario, `r` como recargo sobre costo, `m` como margen sobre venta neta y `t` como tasa del impuesto configurada para el producto/periodo.

Ofrecer tres modos excluyentes:

```text
Recargo sobre costo:     V = C × (1 + r)
Margen sobre venta:      V = C / (1 - m)
Precio final manual:    V = P / (1 + t)

impuesto = V × t
precio_final P = V + impuesto
resultado_unitario = V - C
margen_resultante = (V - C) / V       si V > 0
recargo_resultante = (V - C) / C      si C > 0
```

Para objetivos: `r ≥ 0`, `0 ≤ m < 1`. Para impuesto: `0 ≤ t ≤ 1`, sujeto además a la configuración admitida por la empresa. Un precio manual no negativo puede generar pérdida: mostrarla, no ocultarla ni forzarla a cero. Si el denominador es cero, mostrar «No definido» en el indicador correspondiente.

La tasa propuesta de empresa puede sobrescribirse por producto, con vigencia. No inferir tasas especiales por rubro ni fijar 10 % o 18 % dentro de las fórmulas. Los ejemplos de tasas son datos didácticos, no determinaciones tributarias.

Separar siempre valor de venta sin impuesto, impuesto y precio final. El impuesto cobrado no forma parte de ventas netas ni de utilidad. En un precio manual con impuesto incluido, no volver a agregarlo.

Si se redondea un precio sugerido comercialmente, recalcular el margen efectivo desde el precio final adoptado. Mostrar el objetivo y el resultado efectivo por separado.

## 11. Plan de producción, ventas y utilidad

Cada plan contiene empresa, periodo, versión, estado y líneas únicas por producto. Registrar cantidades, precios de venta adoptados y precios de referencia de asignación en campos diferentes. No sumar planes alternativos del mismo mes; seleccionar uno como plan activo.

```text
ventas_netas = suma(cantidad_i × valor_venta_adoptado_i)
CMP_total = suma(cantidad_i × CMP_unitario_i)
CMOD_asignada_total = suma(cantidad_i × CMOD_unitario_i)
costos_periodo = CMP_total + costo_MOD_disponible_total + CIF_total + gastos_total
utilidad_operativa_estimada = ventas_netas - costos_periodo
margen_operativo_estimado = utilidad_operativa_estimada / ventas_netas
```

Usar la fórmula de utilidad solo en planes completos, factibles y bajo el supuesto explícito de producción igual a ventas. Si ventas netas es cero, el margen es indefinido aunque la pérdida monetaria sí pueda calcularse.

Puente de conciliación:

```text
costos_periodo = suma(cantidad_i × costo_completo_unitario_i)
                + MOD_no_absorbida_total + CIF_no_asignado + gastos_no_asignados
```

No restar de nuevo los gastos distribuidos ni añadir toda la nómina después de haberla clasificado. Un resultado por producto antes de costos no absorbidos no debe llamarse utilidad final de la empresa.

No promediar márgenes porcentuales de productos para obtener el margen de empresa. Calcularlo desde ventas y utilidad totales. No sumar cantidades de unidades incompatibles en una tarjeta única: agrupar por unidad o mostrar unidades equivalentes identificadas.

## 12. Presupuestos, versiones y trazabilidad

Estados mínimos: borrador, publicado y archivado. Un presupuesto publicado guarda cantidades, recetas, costos de materiales, componentes laborales, tiempos, impuestos, bases, importes, precios adoptados, resultados y versión del motor usados en su cálculo.

El borrador permite recalcular; cambios de datos invalidan resultados anteriores y requieren recálculo. Publicar en una transacción después de validar integridad, capacidad y asignación de todos los importes positivos. No publicar cálculos incompletos.

Una revisión crea una nueva versión; no sobreescribe el presupuesto publicado. Registrar autor y fecha. Guardar cada concepto una sola vez y referenciarlo en las vistas; las copias inmutables de publicación son deliberadas para trazabilidad.

Comparación real versus presupuesto queda para una fase posterior. Preparar: `variacion = real - presupuestado`; porcentaje solo si el presupuesto es distinto de cero, y favorabilidad según el tipo de concepto. No etiquetar valores estimados como reales.

## 13. Modelo de datos mínimo

Entidades propuestas, a implementar por fases:

```text
User, Company, Industry, Period
Unit, Material, MaterialCostVersion, MaterialConversion
Product, RecipeVersion, ProductMaterial, ProductLabor
Employee, EmployeePeriodCost, LaborCostComponent
IndirectCost, Expense, AllocationRule
ProductionPlan, ProductionPlanDetail
Budget, BudgetSnapshot
```

No añadir tablas sin una necesidad concreta. Las configuraciones sencillas de rubro pueden ser JSON versionado. Usar relaciones, claves foráneas, índices, restricciones de unicidad por empresa y validaciones de pertenencia entre entidades relacionadas.

Datos derivados se calculan en servicios; solo persistirlos con su contexto/versionado o como caché invalidable. Archivar registros en uso en lugar de borrar referencias históricas.

## 14. Arquitectura y tecnologías

Mantener Python 3.12+, Flask, SQLAlchemy, Flask-Migrate, Flask-Login, Flask-WTF, Bootstrap 5 e iconos. SQLite en desarrollo, diseño compatible con PostgreSQL. Fijar versiones compatibles al implementar y documentar instalación reproducible.

```text
costos_app/
  app/
    __init__.py
    extensions.py
    models/
    routes/
    services/
      units.py
      materials.py
      labor.py
      allocation.py
      costing.py
      pricing.py
      budgets.py
    templates/
    static/css/
    static/js/
    utils/
  migrations/
  tests/
  instance/
  config.py
  run.py
  seed.py
  requirements.txt
  README.md
  .env.example
  .gitignore
```

Usar application factory y blueprints. Separar consultas al ORM de funciones puras de cálculo que reciben datos tipados y devuelven importes, desglose y estados. No implementar las fórmulas dentro de rutas, templates ni JavaScript como única fuente de verdad.

Servicios conceptuales: conversión de unidades; cantidad bruta; CMP por lote/unidad; costo laboral y capacidad; CMOD; distribución por base; costo completo; precio/margen; conciliación de plan; publicación de presupuesto.

## 15. Seguridad y multiempresa

Registro, login y logout; contraseñas con hash seguro, CSRF, validación de formularios, sesiones y rutas protegidas. Secretos por entorno; `.env` fuera del repositorio; cookies seguras según entorno y consultas parametrizadas mediante ORM.

Un usuario posee varias empresas y cambia la empresa activa desde el encabezado. Validar acceso en cada lectura y escritura, incluidas relaciones indirectas. No confiar en `empresa_id`, producto, material, trabajador, periodo o presupuesto enviados por el cliente.

Separar datos por empresa. Código de producto/material único dentro de la empresa; email único normalizado. RUC con validación básica configurable, sin asumir que formato válido acredita existencia legal.

## 16. Interfaz y flujo

Interfaz empresarial limpia, en español, con sidebar colapsable, navbar, tarjetas, tablas filtrables, formularios accesibles, estados vacíos y diseño adaptable a computadora, tablet y celular. No copiar la apariencia de una hoja de cálculo.

Flujo: empresa → rubro → periodo → materiales/personal → productos/recetas → plan → CIF/gastos → costos/precios → presupuesto.

Menú: Dashboard; Productos; Materiales e insumos; Personal; Costos y gastos; Producción; Presupuestos; Reportes; Configuración.

El cuadro de costos muestra por producto: unidad, lote, cantidad del plan, CMP, CMOD, CIF, costo de producción, gastos asignados, costo completo, precio neto, impuesto, precio final y margen. Permitir abrir el origen de cada importe y su regla.

Dashboard del plan seleccionado: ventas netas, CMP, MOD disponible/asignada/no absorbida, CIF, gastos, costos del periodo, utilidad y margen. Mostrar cifras unitarias separadas de totales y señalar resultados parciales. No mostrar un indicador verde de rentabilidad si faltan costos.

## 17. Datos demo y alcance excluido

Seed de rubros: textil, muebles, imprenta y restaurantes. Datos financieros demo solo mediante comando explícito e idempotente, aislados de empresas del usuario y claramente ficticios.

Ejemplos: Textiles Andinos SAC/polo; Muebles Roble SAC/escritorio; Gráfica Lima SAC/volantes; Restaurante Marino SAC/ceviche. Deben funcionar con el mismo motor.

No implementar inicialmente facturación electrónica, SUNAT, contabilidad financiera completa, planilla legal automática, compras, POS, CRM, inventarios, kardex, bancos ni conversiones monetarias. Exportación Excel/PDF, escenarios, punto de equilibrio, inventarios y comparación real/presupuesto quedan para ampliaciones.

## 18. Pruebas numéricas obligatorias del motor

Usar `pytest`, `Decimal` y resultados independientes de la implementación. Las tasas y cifras siguientes son ficticias y sirven solo para probar aritmética.

1. Conversión: 250 g a 80 por kg → CMP 20.
2. Pérdida: 0.25 kg útiles, merma 20 %, precio 80/kg → entrada 0.3125 kg y costo 25. Adicional 20 % sobre la misma necesidad → 0.30 kg y costo 24. Modo bruto 0.25 kg → costo 20.
3. Lote: materiales por 120 para 20 unidades buenas → CMP unitario 6; 100 unidades → CMP total 600.
4. Trabajo: costo mensual 2 400, 20 días, 8 horas, sin exclusiones y factor productivo 80 % → 7 680 minutos, tarifa 0.3125; 8 minutos por unidad → CMOD 2.50.
5. Recurso mixto: el mismo trabajador con 50 % MOD tiene costo directo disponible 1 200 y 3 840 minutos MOD; la tarifa sigue siendo 0.3125. El otro 50 % solo se registra en su función correspondiente.
6. Distribución: CIF 900, bases 100 y 200 → asignación 300 y 600. Si son unidades equivalentes con factor 1 y cantidades 100/200, CIF unitario 3 para ambos.
7. Ventas como base: cantidades 10/20 y valores de referencia 100/25 → bases 1 000/500; costo a distribuir 300 → asignaciones 200/100. Cambiar el precio sugerido sin cambiar la referencia no altera esta asignación.
8. Precio: C=100 y recargo 25 % → V=125 y margen 20 %. C=100 y margen 25 % → V=133.333333… antes de redondeo. Con impuesto didáctico 18 %, el primer precio final es 147.50.
9. Precio manual: P=118, t=18 %, C=80 → V=100, impuesto 18, resultado 20 y margen 20 %.
10. Conciliación completa: 800 unidades; CMP 6/u; trabajador del caso 4 con 8 min/u; CIF 800; gastos 400; venta neta 15/u. CMP=4 800, MOD asignada=2 000, MOD no absorbida=400, CIF=800, gastos=400; costo completo=10/u; costos del periodo=8 400; ventas=12 000; utilidad=3 600; margen=30 %. La suma de resultados por producto antes de MOD no absorbida es 4 000, no 3 600.
11. Capacidad: con el trabajador del caso 4, 1 000 unidades a 8 minutos requieren 8 000 minutos; exceden la capacidad en 320 y bloquean publicación.
12. Redondeo: distribuir 100 entre tres bases iguales → 33.34, 33.33 y 33.33 con desempate estable; suma exacta 100.

Agregar casos de merma 100 % rechazada, cantidades negativas, productividad cero, base cero con costo positivo, denominadores cero, conversiones incompatibles, datos ausentes, precio cero, precio con pérdida, margen objetivo 100 % rechazado, recetas sin componentes declarados y fechas de vigencia.

Verificar también aislamiento entre usuarios/empresas, CSRF, relaciones cruzadas rechazadas, no duplicación de nómina, inmutabilidad de presupuestos publicados, invalidación de borradores y persistencia decimal. No tomar celdas erróneas del Excel como resultados esperados.

## 19. Desarrollo por fases y dependencias

No construir toda la aplicación en un único cambio. Completar la fase autorizada con pruebas y documentación.

1. Base técnica: estructura, factory, configuración, ORM, migraciones, autenticación, modelos User/Company/Industry, layout y dashboard vacío.
2. Empresas, periodos, unidades y configuración: CRUD, rubros, empresa activa, moneda y tasas configurables.
3. Materiales: versiones de costo, conversiones y validaciones.
4. Personal: componentes mensuales, distribución funcional, tiempo y tarifa.
5. Productos: recetas por lote, merma, operaciones, CMP y CMOD.
6. Plan de producción: cantidades, referencias de precio, demanda de recursos y capacidad. Debe existir antes de asignar CIF.
7. CIF y gastos: bases, distribución, conciliación y origen de nómina.
8. Cuadro de costos y precios: costos unitarios/totales, recargo, margen, impuesto y precio adoptado.
9. Presupuestos: recálculo completo, validaciones de publicación, versiones e instantáneas.
10. Dashboard y reportes en pantalla: indicadores conciliados, navegación y pruebas integrales.

## 20. Primera tarea cuando se solicite implementar

Implementar únicamente la fase 1. Antes de editar, inspeccionar repositorio e instrucciones aplicables, explicar brevemente el plan y los archivos afectados. Conservar funcionalidades existentes y no duplicar arquitectura.

Entregar estructura, Flask, SQLAlchemy, Flask-Migrate, Flask-Login, Flask-WTF, User/Company/Industry, registro/login/logout, navbar/sidebar responsive, dashboard vacío, seed de cuatro rubros, pruebas básicas, README, `.env.example`, `.gitignore` y dependencias.

No implementar todavía cálculos, productos, presupuestos ni datos financieros demo. No ejecutar fases posteriores por el solo hecho de estar descritas en este documento.

Ejecutar pruebas pertinentes, corregir fallos y explicar cómo iniciar y probar lo entregado. El README debe diferenciar funciones implementadas y pendientes, y registrar supuestos, fórmulas, instalación, migraciones y uso de demo conforme avance cada fase.

## 21. Criterios de aceptación de la versión 1.0 completa

Un usuario puede registrarse, crear empresas, seleccionar rubro/periodo, registrar materiales y personal, definir recetas y operaciones, planificar cantidades, distribuir costos/gastos, calcular precios y publicar presupuestos reproducibles.

El mismo motor resuelve los cuatro rubros. Los costos concilian por concepto y periodo, las unidades son consistentes, el precio distingue recargo y margen, la utilidad excluye impuesto cobrado e incluye costos no absorbidos, los históricos no cambian al editar catálogos y ninguna empresa accede a datos ajenos.

## 22. Observaciones del Excel y fuentes conceptuales

Hallazgos del archivo de referencia que deben mantenerse como observaciones, no copiarse como reglas:

- `Hoja2!G32:G48` y `N32:N48` asignan conceptos usando participación en ventas de `G68:G69`, seguida de división por cantidades; no corresponden a reparto uniforme por unidades.
- `Hoja2!G19` usa `C19/100` para camote y omite el costo E19: con 200 g y 3/kg, el cálculo dimensional sería 0.60, no 2.
- `Hoja2!G52` usa 10 %, mientras `N52` usa 18 %. El archivo no basta para determinar qué tasa corresponde aplicar.
- El bloque de ají de gallina está incompleto y propaga divisiones por cero. Un resultado incompleto no es un costo cero.
- `Hoja1!I5` suma C5:G5, por lo que no incorpora H5, rotulado CTS. Verificar composición de beneficios antes de reutilizar el total.
- Hay conversiones implícitas y costos ingresados manualmente, por ejemplo limón y apio. No asumir equivalencias a partir de esos valores.
- El plan mezcla distintas cantidades de días de operación. Los días deben ser datos explícitos del presupuesto, no constantes dispersas.

Referencias consultadas para delimitar el diseño, sin atribuirles las simplificaciones gerenciales propuestas:

- IFRS Foundation, NIC 2 / IAS 2: distingue adquisición, transformación y otros costos necesarios para llevar inventarios a su condición y ubicación. https://www.ifrs.org/issued-standards/list-of-standards/ias-2-inventories/
- SUNAT, orientación sobre crédito fiscal: su procedencia depende de requisitos; el sistema no debe inferir recuperabilidad solo a partir de una tasa. https://orientacion.sunat.gob.pe/3111-06-credito-fiscal

No afirmar cumplimiento tributario, laboral o de valoración de inventarios por implementar estas fórmulas. Si se incorpora una regla legal futura, verificar fuente oficial, vigencia y régimen aplicable, versionarla y cubrirla con pruebas.
