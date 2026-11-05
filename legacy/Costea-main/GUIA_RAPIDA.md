# Costea 1.0 — Guía rápida

## Abrir el programa

En este equipo abre `Iniciar-Costea.cmd` con doble clic y entra a **http://127.0.0.1:5000**. Si el servidor ya está encendido, basta abrir la dirección. Conserva abierta la ventana del iniciador; `Ctrl+C` lo detiene. Después de reiniciar Windows, vuelve a abrir el iniciador. No se instala un servicio de arranque automático.

Ingresa con tu cuenta existente. Tus empresas y datos previos se conservan.

## Flujo completo

1. **Mis empresas:** elige o crea tu empresa. Revisa moneda, rubro y unidades. La moneda se bloquea al tener datos de costos, productos o planes.
2. **Periodos:** crea el mes y configura el impuesto. Vacío significa pendiente; cero es una tasa explícita.
3. **Productos / platos:** crea el producto y el rendimiento del lote. Agrega insumos, cantidades, unidades y precios. Puedes usar el catálogo o registrar un insumo directamente. Cada edición crea otra versión de receta.
4. **Personal:** registra trabajadores y abre **Costo mensual** para cada uno. Ingresa costo del empleador, días, horas, exclusiones y productividad. La distribución entre MOD, CIF, administración y ventas debe sumar 100 %. No dupliques provisiones con pagos ni retenciones con costos del empleador.
5. **Operaciones y aplicabilidad**, dentro de la receta: agrega trabajador, actividad y minutos por lote completo. Si no usa materiales o MOD, decláralo. Esta configuración es específica de la versión: al crear otra receta, revisa también sus operaciones.
6. **Costos y gastos:** registra CIF, administración, ventas y otros gastos del mes. Elige destinatarios y base de reparto. El personal indirecto ya se incorpora automáticamente; no lo repitas aquí. Tampoco repitas costos de adquisición incluidos en materiales.
7. **Producción y precios → Nuevo plan:** elige mes, nombre y fecha de referencia. Confirma el supuesto producción igual a ventas, sin inventarios. Si no hay CIF o gastos, decláralo.
8. **Agregar producto:** selecciona versión de receta, cantidad y precio. La cantidad está en unidades o millares según la receta. Puedes usar recargo sobre costo, margen sobre venta neta o precio final manual. El valor de venta de referencia para repartir costos se ingresa aparte.
9. **Recalcular y revisar:** comprueba pendientes, capacidad, costos, precios y conciliación. El sistema bloquea la publicación si faltan datos, hay costos sin asignar o la demanda supera el tiempo disponible.
10. **Publicar versión del presupuesto:** conserva sus entradas y resultados. Después puedes cambiar el borrador, recalcular y publicar otra versión; la anterior permanece igual.
11. **Usar en reportes:** selecciona un único plan por mes para los indicadores de la vista general y Reportes. Los escenarios alternativos no se suman.

## Cómo revisar los resultados

- **CMP:** materiales por unidad de producto.
- **MOD:** mano de obra directa por unidad.
- **CIF:** costos indirectos de producción; la tabla indica total asignado al producto.
- **Costo de producción:** CMP + MOD + CIF por unidad.
- **Costo completo gerencial:** costo de producción + gastos asignados por unidad.
- **MOD no absorbida:** costo de la capacidad ociosa; se resta en la utilidad del periodo, aunque no esté en el costo unitario.
- **Venta neta:** venta sin impuesto. El impuesto cobrado no es utilidad.
- **Margen efectivo:** se calcula desde el precio final adoptado; puede diferir del objetivo por redondeo.

La utilidad estimada es ventas netas menos materiales, MOD disponible, CIF y gastos. No es la suma simple de los márgenes unitarios cuando hay capacidad ociosa.

## Caso de comprobación

Puedes reproducirlo en una empresa de prueba separada:

- Receta: insumos por 120 para 20 unidades; costo de material 6 por unidad.
- Trabajador: costo mensual 2400; 20 días; 8 horas por día; sin exclusiones; productividad 80 %; 100 % MOD.
- Operación: 160 minutos por lote de 20, equivalentes a 8 minutos por unidad.
- Plan: 800 unidades; CIF 800 y gastos 400, ambos por unidades equivalentes con factor 1.
- Precio final manual 17.70 con impuesto didáctico 18 %, equivalente a venta neta 15.

Resultado: ventas 12000; materiales 4800; MOD asignada 2000 y no absorbida 400; costo completo 10 por unidad; costos del periodo 8400; utilidad 3600; margen operativo 30 %. Con 1000 unidades excedería la capacidad en 320 minutos y no permitiría publicar.

## Conservar la base para actualizaciones

Los datos están en SQL Server (`Costea_Cevicheria`) y la configuración privada en `costos_app/.env`. Conserva el `.env` al actualizar y haz una copia de seguridad de SQL Server antes de cambiar de versión. El código de entrega no incluye tus datos ni contraseñas.

Los presupuestos publicados se pueden consultar, archivar, restaurar y descargar como datos JSON. La impresión se realiza desde el navegador. No hay exportador dedicado de Excel/PDF en esta versión.

Esta versión base funciona localmente. No incluye facturación, inventarios, planilla legal automática, bancos ni comparación con resultados reales.
# Actualización: precios, ventas y dashboard

Consulta [la guía de mejoras](MEJORAS_COSTEA.md) para el nuevo flujo de registro, los precios de venta, las ventas reales y el punto de equilibrio con IGV del 18 %. Los pasos de planificación que siguen conservan su funcionamiento.
