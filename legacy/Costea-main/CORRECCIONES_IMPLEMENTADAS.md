> **Actualización posterior:** [Unidades de SQL Server, solo restaurantes y guardado de platos](costos_app/UNIDADES_Y_PLATOS_SQL.md). La aplicación ahora escribe las especificaciones de platos en `dbo.platos`; las tablas originales del catálogo siguen siendo de solo lectura.

# Entrega de correcciones del restaurante

Se leyó `C:\Users\Usuario\Downloads\CORRECCIONES.txt` y se revisaron sus 16 observaciones. El flujo operativo y la trazabilidad por requisito están en [costos_app/RESTAURANTES.md](costos_app/RESTAURANTES.md).

## Cambios

- Conservación de registro, ingreso, salida, CSRF e históricos, con navegación coherente con el restaurante abierto y protección de relaciones entre restaurantes.
- Conexión real a **Costea_Cevicheria**, base definida en `cevicheria_costos_completo.sql`. Configuración mediante `.env` y autenticación de Windows en este equipo. Consultas de lectura a las tablas originales; no se ejecutó el script ni se recrearon esas tablas.
- Catálogo de categorías, unidades e insumos activos con filtros. Selección de insumos con su referencia de origen y versiones de precio propias; cambios del restaurante no alteran SQL Server.
- Contrato desacoplado y adaptador de archivo para platos/recetas futuros. Copia por restaurante, protección contra selecciones duplicadas y rollback si falla un ingrediente. Sin platos precargados ni recetas inventadas.
- Personalización de ingredientes, cantidades, conversiones, precios, merma y rendimiento con historial. Continuidad de recetas históricas aunque la fuente inactive un insumo.
- Mano de obra por minutos o por porciones comparables, control de capacidad y prevención de doble cobro por múltiples actividades del mismo trabajador.
- Separación de CIF, administración y ventas; bloqueo de conceptos o comprobantes duplicados por restaurante y periodo. La parte indirecta de nómina se incorpora una sola vez.
- Ficha de costo total/precio antes de crear el Plan de Producción; motor compartido de materia prima, MOD, CIF, gastos, precio neto, IGV 18 %, precio final, utilidad y margen.
- Consolidación de insumos por cantidad bruta y unidad base en el plan, conservando referencias a precios diferentes. Publicación de presupuestos inmutables.
- Inicio con guía del flujo; gráficos de ventas retirados. No se añadieron dashboards, predicciones ni animaciones.

## Archivos creados

- `costos_app/app/services/catalog.py`
- `costos_app/app/services/catalog_selection.py`
- `costos_app/app/services/recipe_source.py`
- `costos_app/app/services/personalization.py`
- `costos_app/app/routes/catalog.py`
- `costos_app/app/routes/recipe_source.py`
- `costos_app/app/routes/worksheet.py`
- `costos_app/app/templates/catalog/index.html`
- `costos_app/app/templates/products/source.html`
- `costos_app/app/templates/planning/worksheet.html`
- `costos_app/app/templates/dashboard/workflow.html`
- `costos_app/migrations/versions/d9a4b210a002_restaurant_catalog_references.py`
- `costos_app/tests/test_restaurant_flow.py`
- `costos_app/RESTAURANTES.md`
- Este informe y auxiliares de verificación en `.artifacts/`.

## Archivos modificados

- Configuración: `costos_app/config.py`, `requirements.txt`, `.env.example`, `.env` (configuración privada local conservada y ampliada).
- Registro de módulos/CLI: `costos_app/app/__init__.py`, `app/cli.py`.
- Modelos: `app/models/material.py`, `product.py`, `planning.py`.
- Formularios: `app/forms/planning.py`.
- Servicios: `app/services/companies.py`, `costing.py`, `planning.py`, `sectors.py`.
- Rutas: `app/routes/companies.py`, `dashboard.py`, `planning.py`, `products.py`, `sales.py`.
- Plantillas: `app/templates/layout.html`, `materials/index.html`, `products/index.html`, `products/detail.html`, `planning/_results.html`, `planning/employees.html`, `sales/_results.html`.
- Pruebas: `tests/test_costing_engine.py`, `tests/test_sales.py`.
- Documentación: `README.md` y `costos_app/README.md`.
- Base propia `costos_app/instance/costos.db`: migración aditiva aplicada. Respaldo previo: `.artifacts/backups/before-restaurants-20260924-021815.db`.

Las rutas abreviadas de las listas de archivos modificados se entienden relativas a `costos_app/`.

## Verificación ejecutada

- Suite original previa a cambios: **136 pruebas aprobadas**.
- Suite final: **152 pruebas aprobadas** (`pytest -q`). Incluye flujo HTTP completo de costos y publicación, cantidades y porcentajes inválidos, conversiones y merma, reparto por tiempo/porciones, duplicados, aislamiento, CSRF, fuente inactiva, rollback y conservación de versiones.
- `ruff check .`: correcto.
- `ruff format --check .`: **66 archivos con formato correcto**.
- `flask --app run db check`: sin diferencias de esquema pendientes.
- `flask --app run check-catalog`: conexión real comprobada, **9 categorías, 2 unidades, 500 insumos activos**.
- `.artifacts/test_live_catalog.py`: registro, login, creación de restaurante, consulta y selección de insumo SQL real, guardado de receta, formularios y logout con CSRF activo. Datos de prueba únicamente en SQLite en memoria; SQL Server solo lectura.
- Migración aplicada primero sobre una copia y después sobre la base local. Comparación de todas las filas y columnas preexistentes: **contenido íntegro**.
- Servidor local iniciado; `GET http://127.0.0.1:5000` llega al acceso con **HTTP 200** y formulario CSRF. No hubo navegador conectado para una inspección visual; la navegación y los formularios se comprobaron mediante las pruebas HTTP.

## Pendiente externo

El equipo debe entregar la fuente real de platos y recetas: identificadores estables, versiones, nombres, rendimiento, IDs de insumo, cantidades, unidades y merma. Debe confirmar el significado de las cantidades y el tratamiento de los precios mayoristas. El adaptador JSON está listo mediante `RECIPE_SOURCE_FILE`; si la entrega es una API u otra base, implementar el mismo contrato `RecipeSource`. No se requieren credenciales SQL adicionales para la conexión local comprobada.
