# Historial de versiones

## 1.0.0 — 21 de septiembre de 2026

- Flujo integrado desde empresas y recetas hasta presupuestos publicados.
- Personal y costo mensual del empleador, distribución funcional y capacidad.
- Operaciones de receta y declaraciones explícitas de componentes no aplicables.
- Planes mensuales independientes con cantidades, recetas seleccionadas y precios.
- CIF y gastos por destinatarios y bases de reparto: equivalentes, minutos MOD y ventas de referencia.
- Incorporación automática de personal indirecto; separación de MOD asignada y ociosa.
- Precios por recargo, margen o precio final manual; impuesto configurable y margen efectivo.
- Conciliación de costos, validación de capacidad y bloqueo de publicación incompleta.
- Presupuestos inmutables, revisiones, archivado y descarga de datos.
- Vista general y reportes del plan activo por empresa y periodo.
- Iniciador para Windows, guía de uso y paquete de código sin datos privados.

Se conserva el módulo previo de productos y recetas versionadas. Las migraciones son aditivas y conservan las cuentas y catálogos anteriores.
# Mejoras de septiembre de 2026

- Precios de venta por producto y registro de ventas reales persistidos en SQLite.
- Dashboard mensual con IGV del 18 %, utilidad, equilibrio, gráficos y tablas por producto.
- Conservación del precio y costo de ingredientes de cada venta; validación por empresa y periodo.
- Menú ordenado, guía de registro y costo directo de referencia como primera opción.
- Migración aditiva `c7e92026a001` y pruebas de ventas, cálculos y aislamiento.
