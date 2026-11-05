> **Actualización posterior:** [Unidades de SQL Server, solo restaurantes y guardado de platos](costos_app/UNIDADES_Y_PLATOS_SQL.md). La aplicación ahora escribe las especificaciones de platos en `dbo.platos`; las tablas originales del catálogo siguen siendo de solo lectura.

> **Actualización de restaurantes:** seguir [costos_app/RESTAURANTES.md](costos_app/RESTAURANTES.md) para el flujo vigente, SQL Server, configuración y contrato de recetas. Esta actualización reemplaza el dashboard inicial por una guía de costos. Las notas de versiones anteriores se conservan debajo.

# Costea 1.0

Versión base funcional de costos y presupuestos multiempresa: materiales, personal, recetas, producción, CIF/gastos, precios, presupuestos versionados y reportes.

- [Guía rápida de uso](GUIA_RAPIDA.md)
- [Instalación, arquitectura y reglas](costos_app/README.md)
- [Cambios de esta entrega](CHANGELOG.md)
- [Mejoras: precios, ventas y dashboard con punto de equilibrio](MEJORAS_COSTEA.md)
- [Despliegue en Azure App Service](AZURE_DEPLOYMENT.md)

En este equipo: abrir **Iniciar-Costea.cmd** y entrar a **http://127.0.0.1:5000**.

Los datos se guardan en la base SQL Server `Costea_Cevicheria`, configurada mediante `costos_app/.env`. La copia de código para próximas actualizaciones está en `entregas/Costea-1.0-codigo.zip`; no incluye datos privados ni el entorno virtual.
# Mejoras basadas en el Excel

Planilla detallada, costo por minuto, merma, gastos financieros, precio por Food Cost y plan de negocio: [documentación de implementación y fórmulas](costos_app/MEJORAS_EXCEL.md).
