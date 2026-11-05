# Inventarios conectados

En Inventarios, Usar como entrada permite seleccionar compras guardadas sin volver a escribir cantidades, precios, fecha ni comprobante.

- Las compras guardadas aportan cantidad convertida a unidad base, fecha y costo de adquisicion sin impuesto recuperable.
- Una receta registra consumo de insumos, no una compra ni una entrada de existencias. Sus cantidades no se ofrecen como origen de entrada.
- El kardex muestra el nombre y tipo del insumo, por ejemplo Papa - Amarilla, para distinguir variantes del mismo nombre.
- La seccion Salidas de recetas simula un lote de cada plato activo. Agrupa por insumo la cantidad de todos los platos que lo usan y la coloca en la columna SALIDA. El saldo simulado no modifica existencias; los movimientos reales se registran al publicar produccion o registrar ventas.
- El kardex individual repite la salida simulada del insumo seleccionado al final de sus movimientos reales, con saldo proyectado y los platos que componen la cantidad total.
- Cada compra se incorpora una sola vez. Las entradas conservan sus valores originales.
- Las ventas anteriores se sincronizan al actualizar la aplicacion. Las nuevas generan salidas en la misma transaccion. Repetir la sincronizacion no duplica movimientos.
- Una venta nueva y la publicacion de un plan se bloquean si sus insumos exceden la existencia real en la fecha de la operacion o causarian faltantes en movimientos posteriores. Se indica el insumo y la cantidad disponible. Los movimientos historicos ya registrados se conservan.
- Usar una receta base y aumentar o guardar su rendimiento tambien exige existencias para todos sus insumos. Si falta uno, no se crea el plato ni se guarda el nuevo rendimiento. Las tarjetas y fichas de platos existentes muestran Elaboracion bloqueada y los insumos faltantes; el costo calculado no implica disponibilidad.
- Al pie del kardex individual aparece una alerta de stock bajo cuando la existencia real alcanza o cae por debajo de lo necesario para un lote de cada plato activo que usa ese insumo.
- El consumo usa la receta historica de la venta, conversion, merma y rendimiento. Eliminar una venta anula sus salidas y conserva la referencia de auditoria.
- El kardex usa promedio ponderado movil y precision decimal. Dentro del mismo dia procesa las entradas primero. Cuando faltan entradas, muestra saldo negativo y valoracion pendiente desde ese punto. Completar las entradas historicas faltantes permite recalcular. No inventa existencias para cubrir ventas.
- El costo de materia prima de la receta, la ficha y el plan toma el promedio ponderado del kardex por insumo a la fecha de referencia. La venta guarda el costo calculado a su fecha. Si no hay entradas, se usa el precio de referencia fijado en la receta. Si hay entradas pero el kardex queda con valoracion pendiente, los planes no publican un precio sugerido hasta completar las entradas. Con saldo cero se conserva el ultimo promedio valido como referencia de precio.
- Cada movimiento debe corresponder al mismo insumo local y expresarse en su unidad base. Dos compras del mismo insumo a distintos precios se ponderan por sus cantidades; dos registros de insumo distintos mantienen kardex separados. Los presupuestos ya publicados conservan su instantanea.

Los precios sin cantidad de compra no constituyen una entrada cuantificable. El catalogo original de SQL Server no se modifica. Los movimientos se conservan en la base transaccional de Costea, como las ventas. Los costos historicos de los reportes de ventas se mantienen; el kardex valora sus salidas por promedio.

Se mantiene compatibilidad con solicitudes del registro manual anterior; la pantalla principal solo solicita seleccionar compras guardadas.
