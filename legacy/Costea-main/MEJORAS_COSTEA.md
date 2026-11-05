# Mejoras de Costea — septiembre de 2026

## Uso

Abre `Iniciar-Costea.cmd` y entra en http://127.0.0.1:5000. La actualización prepara SQLite y aplica las migraciones pendientes. Esta copia de origen no contenía usuarios ni una base de datos: crea tu cuenta al entrar. Los datos de prueba se ejecutan en bases separadas.

1. En **GENERAL**, registra empresa y sector, periodo y unidades.
2. Registra las materias primas de la empresa en **Materiales e insumos**. Al configurar su costo aparece primero **Costo directo de referencia**, seguido de **Costo por adquisición**.
3. Crea platos o productos. Agrega ingredientes, cambia cantidades, merma, unidades y costos, o retira ingredientes. Cada guardado conserva la relación y crea una versión de receta; los insumos nuevos también quedan en el catálogo de esa empresa y sector.
4. En **GESTIÓN Y PRESUPUESTOS**, completa personal y costos del mes. Clasifica los conceptos como fijos o variables.
5. En **Precios de venta**, guarda el importe final por unidad, incluido IGV del 18 %. «Editar precio» carga el valor actual. También puedes llegar desde la ficha del producto.
6. En **Registro de ventas**, selecciona producto, fecha y cantidad. La fecha debe pertenecer al periodo activo. La lista muestra el precio y la unidad. Se necesita un precio y una receta con ingredientes costeados.
7. Consulta **Inicio y dashboard** para ver ventas, costos, utilidad, punto de equilibrio, productos más vendidos y tablas. Cambia de periodo para consultar otro mes.

Los formularios guardan automáticamente en SQLite al pulsar Guardar, Agregar o Quitar. No hay un paso adicional de sincronización ni se requiere conexión externa. Las ediciones de ingredientes y precios se aplican a registros posteriores; las ventas ya guardadas conservan su precio, costo de ingredientes y versión de receta. Para corregir una venta, elimínala y vuelve a registrarla.

## Cálculos del balance de ventas

- Ventas netas = ventas con IGV / 1.18.
- Costo variable = ingredientes consumidos + conceptos mensuales clasificados como variables.
- Costo fijo = conceptos mensuales fijos + nómina mensual completa. La nómina se cuenta una sola vez; no debe duplicarse en conceptos.
- Utilidad = ventas netas − costos variables − costos fijos.
- Margen de contribución = (ventas netas − costos variables) / ventas netas.
- Equilibrio neto = costos fijos / margen de contribución; con IGV = equilibrio neto × 1.18.

El equilibrio conserva la mezcla de ventas y la proporción variable del periodo. Sin ventas no hay base para estimarlo; con contribución nula o negativa se explica por qué no es alcanzable. Con contribución positiva y costos fijos cero, el umbral es cero. Los costos fijos y conceptos variables se distribuyen entre productos proporcionalmente a sus ventas netas para la tabla; el cálculo general incluye también los costos de meses sin ventas.

Los resultados dependen de completar los costos del mes. El personal sin configuración mensual genera un aviso. Se mantiene la hipótesis original de producción igual a ventas, sin inventarios. El balance de ventas usa IGV fijo del 18 %; los escenarios de producción preexistentes conservan sus propias tasas configuradas y sus presupuestos históricos.

## Persistencia y validación

La migración `c7e92026a001` agrega precios por producto y ventas sin alterar las tablas anteriores. Los importes se almacenan como decimales exactos. Cada operación verifica la propiedad de la empresa y las relaciones; los formularios mantienen protección CSRF.

Pruebas ejecutadas: suite de 136 casos, revisión de estilo y formato, conciliación del esquema con Alembic y revisión visual del dashboard en navegador. Se incluyen IGV, equilibrio, ventas sin margen, datos faltantes, aislamiento de empresas, eliminación, precios históricos y migraciones que conservan información existente.
