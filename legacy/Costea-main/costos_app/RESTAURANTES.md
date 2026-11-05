> **Actualización vigente:** toda la aplicación, el catálogo, los platos y las recetas usan la misma base SQL Server mediante `DATABASE_URL`.

# Correcciones del flujo de restaurantes

## Actualización de precios, apertura y personal

`cevicheria_costos_completo.sql` contiene el catálogo actualizado, los precios mayoristas, las cantidades propuestas en `insumos.stock_inicial` y el escenario laboral simulado. Para actualizar una base Azure SQL existente, usar `actualizar_costea_azure.sql` en la conexión a `Costea_Cevicheria`, con el modo SQLCMD de SSMS activado. La aplicación no ejecuta ese archivo automáticamente.

**Inventarios** incorpora automáticamente `insumos.stock_inicial` como entradas iniciales, una vez por restaurante e insumo. Al desplegar, `flask --app application sync-catalog-data` actualiza todos los restaurantes en PEN, incluidos los que tienen movimientos. Los nuevos restaurantes reciben las entradas al crearse. La fecha es el inicio más antiguo de sus períodos o movimientos, o su fecha de creación si es anterior. La cantidad consumida no se repone al reiniciar; tampoco se reincorporan entradas anuladas. Las entradas que ya se importaron con el botón anterior se reconocen y no se duplican. La pantalla muestra el detalle completo de cantidades, unidades, costos y enlaces al Kardex.

**Insumos y Materia Prima** consulta los precios y el stock directamente de SQL Server. La sincronización crea versiones de precio para insumos seleccionados y versiones nuevas de recetas que usaban precios del catálogo. Copia las operaciones laborales y actualiza los planes sin presupuestos publicados que seguían esa receta. Los precios personalizados, las recetas anteriores, las ventas y los presupuestos publicados conservan sus referencias. El costo vigente de inventario continúa calculándose por promedio ponderado.

**Personal** muestra el escenario laboral simulado y permite abrir cada contrato: hijos acreditados, escolaridad, jornada, vacaciones, pensión, EsSalud, EPS, seguros, CTS, gratificaciones y desglose anual completo. Los importes se leen de las vistas del SQL actualizado. Esos datos no se agregan a trabajadores ni planes reales de un restaurante. El archivo SQL no contiene estado civil, de modo que la aplicación tampoco lo muestra como dato capturado.

La aplicación guarda cuentas, costos, planificación, catálogo, platos y recetas en **Costea_Cevicheria**. El script unificado entregado debe ejecutarse primero y Alembic crea después las tablas internas de Costea en esa misma base.

## Iniciar y verificar

Desde la raíz, ejecutar `Iniciar-Costea.cmd` y abrir http://127.0.0.1:5000. El iniciador aplica las migraciones aditivas. Los datos del usuario y los históricos se conservan.

En `costos_app/.env`, configurar `DATABASE_URL` siguiendo `.env.example`. Instalar las dependencias de `requirements.txt` y Microsoft ODBC Driver 18. Se admite autenticación Windows o SQL; nunca guardar contraseñas en archivos de código. La cuenta necesita permisos de migración sobre las tablas internas y lectura/escritura sobre las tablas de catálogo, platos y recetas que usa la aplicación.

Desde `costos_app`, verificar con:

```powershell
..\.venv\Scripts\python.exe -m flask --app run check-catalog
..\.venv\Scripts\python.exe -m pytest -q
..\.venv\Scripts\python.exe -m ruff check .
..\.venv\Scripts\python.exe -m ruff format --check .
..\.venv\Scripts\python.exe -m flask --app run db check
```

En este equipo se ha configurado `localhost`, autenticación Windows, cifrado activado y aceptación del certificado local (`TrustServerCertificate=yes`). En un despliegue con certificado confiable, usar `no`. Configuración del dialecto: [documentación de SQLAlchemy](https://docs.sqlalchemy.org/en/20/dialects/mssql.html#connecting-to-pyodbc).

El programa no ejecuta el script SQL, no vuelve a crear la base y no registra las tres tablas del equipo en sus migraciones. Consulta categorías/unidades/insumos desde SQL Server. Solo guarda los insumos que el restaurante selecciona, sus referencias de origen y versiones de precio: son datos propios necesarios para la personalización y el historial, no una réplica del catálogo completo. Los equivalentes físicos `kg/g`, `l/ml` pertenecen al motor de conversión; las unidades de compra y sus descripciones se obtienen de SQL Server.

## Flujo

1. Registro, ingreso y selección/creación del restaurante.
2. En **Platos y recetas**, selección de uno de los 20 platos base del equipo o registro explícito de una receta propia. La selección crea una copia editable dentro del restaurante, sin modificar la fuente.
3. Personalización de materia prima: seleccionar insumos activos de SQL Server, editar cantidad, unidad, precio, merma y rendimiento, o escalar proporcionalmente toda la receta a otro número de porciones. Para sustituir: quitar la fila y agregar el reemplazo. Cada acción conserva una versión anterior.
4. Personal: chef, cocinero, ayudante u otro cargo. Registrar costo mensual y distribución entre trabajo directo, cocina, administración y ventas. Elegir reparto directo por minutos o por porciones comparables. En el segundo caso indicar las porciones mensuales previstas. Asignar los trabajadores a la receta desde su ficha; minutos 0 solo cuando se reparten por porciones.
5. CIF: gas, luz, agua, mantenimiento, depreciación y área de cocina. Administración y ventas se clasifican por separado. No repetir nómina: la fracción indirecta del personal se agrega automáticamente.
6. Ficha **Costo total y precio de venta**: seleccionar receta, mes, porciones previstas y objetivo de precio. Usa exactamente el mismo motor que producción. La ficha inicial supone un solo plato; al añadir otros platos al plan se recalculan las bases y los precios.
7. **Plan de Producción**: seleccionar platos/recetas y cantidades, consolidar insumos con merma, revisar costos, capacidad, ingresos sin IGV y utilidad. Publicar conserva un presupuesto inmutable.

Las unidades de caja/paquete requieren una equivalencia por insumo, registrada en **Insumos y Materia Prima → Mis Insumos / En Uso → detalle → equivalencias**: unidades base por caja o paquete y sustento. No se supone que todas las cajas contienen lo mismo. Las conversiones incompatibles se rechazan.

## Fórmulas y controles

- Materia prima: cantidad × factor de conversión; en cantidad neta con merma, dividir por `(1 − merma)`. Multiplicar por precio guardado y dividir entre rendimiento para obtener costo por porción.
- MOD por tiempo: costo directo mensual / minutos directos disponibles × minutos por porción. MOD por producción: costo directo mensual / porciones previstas; un trabajador no cobra dos veces la misma porción aunque tenga varias actividades.
- Producción = materia prima + MOD asignada + CIF. Total asignado = producción + administración + ventas + otros gastos declarados. El costo mensual también reconoce MOD no absorbida y costos sin base, visibles en conciliación.
- Precio por margen: costo total por porción / `(1 − margen)`. Precio por recargo: costo × `(1 + recargo)`. También admite precio final manual. Los restaurantes usan IGV del **18 %**.
- Precio final = precio sin IGV + IGV. Utilidad unitaria = precio neto − costo unitario; margen = utilidad / precio neto. Precio 0 y costo 0 no provocan división entre cero.
- Plan: sumar las cantidades brutas de cada insumo en su unidad base, ajustadas a porciones/rendimiento. Los precios distintos conservan sus versiones; se suman los importes sin promediar o sobreescribir precios históricos.
- Se bloquean costos con el mismo nombre normalizado o referencia/comprobante en el mismo restaurante y mes, incluso en categorías distintas. Los duplicados concurrentes de referencia se bloquean también en base de datos. El usuario debe usar la misma referencia para el mismo documento: no es posible inferir que documentos con nombres e identificadores distintos son el mismo gasto.
- Sesiones, CSRF, verificación de propietario en cada ruta, validación de relaciones y versiones protegen datos de restaurantes diferentes, incluso cuando son del mismo usuario. La navegación sigue el restaurante de la página abierta.
- Los insumos inactivos desaparecen de la selección externa y se rechazan al agregarlos de nuevo; sus recetas anteriores y presupuestos permanecen consultables. Una caída del catálogo muestra un aviso y no borra históricos.
- Se sustituyó el dashboard inicial por una guía operativa. No se agregaron gráficos, predicciones ni animaciones.

## Fuente SQL de platos

El equipo debe entregar una fuente autorizada con ID estable del plato, versión, nombre, porciones de rendimiento y sus ingredientes. Cada ingrediente debe referenciar `insumos.id_insumo`, indicar cantidad y unidad de consumo, y opcionalmente porcentaje de merma. Confirmar que las cantidades sean netas cuando hay merma y que los precios mayoristas del catálogo sean costos en PEN sin IGV recuperable; el esquema SQL no declara tratamiento tributario.

La interfaz `RecipeSource.dishes()` en `app/services/recipe_source.py` lee directamente `dbo.platos` y `dbo.receta_detalles`, filtrando el catálogo base por `id_instalacion = 'CATALOGO-BASE'`. Devuelve objetos `SourceDish`/`SourceIngredient` validados e inmutables; las pantallas y fórmulas no cambian.

Formato, sin platos ficticios:

```json
{"schema_version": 1, "dishes": []}
```

Cada elemento de `dishes` requiere:

| Campo | Tipo / regla |
|---|---|
| `id` | Texto estable, único, hasta 180 caracteres |
| `version` | Texto de versión, hasta 80 caracteres |
| `name` | Nombre entregado por el equipo, hasta 180 caracteres |
| `portions` | Decimal positivo como texto |
| `ingredients` | Lista no vacía, sin insumos duplicados |
| `ingredients[].insumo_id` | Entero positivo existente y activo en SQL Server |
| `ingredients[].quantity` | Decimal positivo como texto, cantidad del lote |
| `ingredients[].unit_code` | Código físico compatible: `kg`, `g`, `l`, `ml`, `unit` |
| `ingredients[].loss_percent` | Decimal como texto entre 0 y menos de 100; opcional, defecto 0 |

La selección crea una copia del plato para el restaurante, con referencia a su ID y versión de origen. No escribe en el archivo ni en el proveedor. Seleccionar dos veces el mismo plato para el mismo restaurante se rechaza; abrir la personalización existente. Cada restaurante puede personalizarlo de forma independiente. Una fuente que incluya cajas/paquetes debe entregar su factor específico para ampliar el contrato; mientras tanto esas presentaciones se personalizan con equivalencias locales explícitas.

## Trazabilidad de las 16 observaciones

| Requisito | Implementación / verificación |
|---|---|
| 1 | `routes/auth.py`, `services/companies.py`; pruebas de autenticación, CSRF y aislamiento |
| 2–4 | `services/catalog.py`, `catalog_selection.py`, `routes/catalog.py`, `.env`; verificación real `check-catalog` |
| 5–6 | `recipe_source.py`, `personalization.py`, recetas versionadas; pruebas de copia, aislamiento y rollback |
| 7 | `recipes.py`, `units.py`, equivalencias por material; pruebas de merma y conversiones |
| 8 | `costing.py`, personal mensual y operaciones; reparto por tiempo/porciones y capacidad |
| 9–10 | Conceptos por tipo y base; referencia única y nómina incluida una sola vez |
| 11 | Ficha `worksheet.py`, `costing.py`; costos, precio neto, IGV, precio final y margen |
| 12 | `planning.py`, consolidado `requirements`, planes y presupuestos inmutables |
| 13–14 | Navegación ordenada, formularios, listas, ayudas, mensajes y pruebas de entradas inválidas |
| 15 | Capas de rutas, formularios, servicios de cálculo, proveedores y modelos separados |
| 16 | Inicio operativo sin dashboard ni nuevas funciones visuales |

Las pruebas usan cuentas y recetas sintéticas solo dentro de bases aisladas; no se agregan al programa ni a los datos reales. El único pendiente externo es la entrega y validación semántica de la fuente de platos/recetas del equipo.
