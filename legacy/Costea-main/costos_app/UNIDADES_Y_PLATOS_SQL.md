# Unidades, restaurantes y platos guardados en SQL Server

Esta actualización reemplaza la selección general de unidades y rubros de la entrega anterior.

## Unidades del catálogo

La pantalla **Unidades** consulta `Costea_Cevicheria.dbo.unidades_medida` en cada visita: identificador, código y descripción. Actualmente muestra **Litro** y **Kilogramo**, porque son los dos registros de esa tabla. No carga metros, superficie, millares, horas ni minutos del catálogo interno general. Si el equipo añade otra unidad a SQL Server, aparece en la pantalla sin cambiar código.

Las preferencias se guardan por restaurante, usando el ID original de SQL Server. En las recetas se conservan los factores físicos necesarios para expresar consumo en gramos o mililitros, y los históricos anteriores permanecen intactos. La unidad de compra del catálogo y la unidad usada para consumir un ingrediente pueden ser distintas, con conversión explícita.

## Solo restaurantes

Se eliminó el selector de rubro de creación y edición. El servidor asigna **Restaurantes** aunque una solicitud intente enviar otro ID de rubro. También se retiraron las referencias a otros negocios de la pantalla de ingreso y se adaptaron los textos principales. Los registros antiguos de otros rubros permanecen en el almacenamiento para conservar históricos, pero no son opciones para crear negocios nuevos.

## Tabla nueva: dbo.platos

La definición y los datos iniciales están unificados en `../cevicheria_costos_completo.sql`. No se recrearon la base ni las tablas `categorias`, `unidades_medida` e `insumos`.

`dbo.platos` contiene:

- Identificador propio SQL, instalación, restaurante, propietario y plato local.
- Nombre, descripción, moneda, porciones, unidad de producción, versión actual, estado y fechas.
- `especificaciones`, un documento JSON validado en SQL Server, con todas las versiones de receta: ingredientes, ID de insumo de origen cuando aplica, cantidades, unidades, factores y sustento de conversión, precios y su procedencia, merma/adicional, rendimiento, costo de materia prima total y por porción.
- Las operaciones de trabajo por receta, precio de venta guardado y los costos/precios de los planes en los que participa el plato: materia prima, mano de obra, CIF, gastos, IGV, utilidad y margen, junto con cantidades, periodo y estado del cálculo. Los cálculos incompletos conservan sus advertencias; no se presentan como costos definitivos.

La estructura usa columnas para los datos principales y JSON para ingredientes e históricos de longitud variable, manteniendo una sola tabla nueva en SQL Server. Los decimales de las especificaciones se guardan como texto exacto. Referencia del formato: [almacenamiento de documentos JSON en SQL Server](https://learn.microsoft.com/en-us/sql/relational-databases/json/store-json-documents-in-sql-tables).

Crear, editar, quitar/agregar ingredientes, archivar/restaurar, cambiar operaciones, registrar precios o modificar costos de planes actualiza automáticamente el registro correspondiente. La clave de instalación + restaurante + plato evita duplicados y mezcla de datos. No se envían contraseñas ni datos de acceso.

La misma base SQL Server conserva la edición y un registro pendiente. Después se actualizan `dbo.platos` y `dbo.receta_detalles`; si falla esa actualización, aparece un aviso explícito y **Reintentar guardado**. Una edición vieja no puede reemplazar otra más reciente.

## Configuración y mantenimiento

`DATABASE_URL` es la única conexión. Apunta a `Costea_Cevicheria` y se usa tanto para las tablas internas como para catálogo, platos y recetas.

`APP_INSTANCE_ID` identifica esta instalación y se genera una sola vez en `.env` mediante `scripts/prepare_local.py`. Conservarlo al actualizar o restaurar un respaldo. Una instalación independiente debe tener otro identificador.

Desde `costos_app`:

```powershell
..\.venv\Scripts\python.exe -m flask --app run db upgrade
..\.venv\Scripts\python.exe -m flask --app run init-dishes
..\.venv\Scripts\python.exe -m flask --app run sync-dishes --all
```

`init-dishes` crea o amplía `dbo.platos` y `dbo.receta_detalles` sin modificar el catálogo. `sync-dishes --all` incluye platos antiguos y archivados; sin `--all` reintenta únicamente los pendientes.

Consulta de verificación en SQL Server:

```sql
USE Costea_Cevicheria;
SELECT id_plato, id_restaurante, nombre, porciones, version_receta,
       activo, fecha_actualizacion, especificaciones
FROM dbo.platos
ORDER BY id_restaurante, id_plato;
```

## Archivos principales

- `app/routes/companies.py`, `app/forms/company.py`, `app/templates/companies/units.html` y `form.html`: unidades originales y registro exclusivo de restaurantes.
- `app/models/restaurant.py` y migración `e8bc410aa003`: preferencias por ID externo y cola persistente local.
- `app/services/dish_snapshot.py`, `dish_storage.py`, `dish_sync.py`: especificaciones, persistencia SQL y reintentos.
- `app/__init__.py`, `app/cli.py`, `app/routes/products.py`: guardado automático y herramientas de mantenimiento.
- `../cevicheria_costos_completo.sql`: catálogo, platos y recetas en un único script SQL.
- `tests/test_sql_dishes.py` y pruebas de empresas/productos actualizadas: comportamiento y aislamiento.

Se aplicó primero la migración a una copia y se compararon todas las filas y columnas previas antes de actualizar la base local. Respaldo: `../.artifacts/backups/before-restaurants-20260924-115511.db`. Los dos platos existentes se guardaron en SQL Server sin pendientes. Se probó además creación, edición de ingredientes, precios, historial y archivo contra SQL Server real dentro de una transacción revertida: no quedaron platos de prueba.

Verificación final: suite general **157 pruebas aprobadas**, seguida por **34 pruebas de productos y persistencia SQL aprobadas**, incluida una prueba adicional de actualización de costos de planes al cambiar la mano de obra. Ruff y verificación de formato correctos; esquema local sin migraciones pendientes. Servidor reiniciado y pantalla de ingreso comprobada con HTTP 200 y sin opciones de otros rubros.
