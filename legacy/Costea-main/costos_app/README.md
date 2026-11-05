> **Configuración vigente:** toda la aplicación usa una sola base SQL Server (`Costea_Cevicheria`) mediante `DATABASE_URL`. Los platos y su receta vigente se integran con `dbo.platos` y `dbo.receta_detalles`.

> **Actualización de restaurantes:** seguir [RESTAURANTES.md](RESTAURANTES.md) para el flujo vigente, SQL Server, configuración y contrato de recetas. Esta actualización reemplaza el dashboard inicial por una guía de costos. Las notas de versiones anteriores se conservan debajo.

# Costea 1.0 — Base funcional de costos y presupuestos

Aplicación local multiempresa para textil, muebles, imprenta y restaurantes. Motor común de costos estándar/estimados y presupuestos mensuales. Python 3.12+, Flask, SQLAlchemy, SQL Server, Bootstrap local y Waitress.

## Entrega

El flujo de las diez fases está integrado: autenticación; empresas/periodos/unidades; materiales; personal; productos/recetas; planes; CIF/gastos; costos/precios; presupuestos; vista general/reportes.

La guía operativa está en `../GUIA_RAPIDA.md`. Las fórmulas conceptuales y el alcance original están en `../PROMPT_CODEX_APP_COSTOS_PRESUPUESTOS_AJUSTADO.md`. Esta entrega implementa una base local funcional, con las simplificaciones explícitas de abajo.

## Iniciar en este equipo

Doble clic en `../Iniciar-Costea.cmd`, o desde la raíz:

```powershell
.\Iniciar-Costea.ps1
```

Abrir http://127.0.0.1:5000. Conservar la ventana del servidor abierta; Ctrl+C lo detiene. Si ya hay una instancia escuchando, usarla; no iniciar una segunda sobre el mismo puerto. La aplicación no configura arranque automático con Windows. Los servidores de pruebas se ejecutan aparte y no modifican la base real.

## Instalación en otro equipo

Extraer el paquete de código, instalar Python 3.12 o superior y, desde su raíz:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r costos_app\requirements.txt
.\.venv\Scripts\python.exe costos_app\scripts\prepare_local.py
.\.venv\Scripts\python.exe costos_app\serve.py
```

Las dependencias fijadas necesitan Internet solo para instalarlas. El uso local no requiere servicios externos. En Linux/macOS usar `.venv/bin/python`.

`prepare_local.py` crea la clave privada solo si no existe `.env`, aplica migraciones y agrega rubros/unidades faltantes; no crea cuentas ni datos financieros. No borra información existente. Después del primer inicio, crear una cuenta.

## Datos y actualización

- Base única: SQL Server `Costea_Cevicheria`; la conexión está en `DATABASE_URL`.
- Configuración privada: `.env`, excluida de Git y del paquete.
- Respaldos de esta actualización: `../.artifacts/backups`, también excluidos.
- Nunca regenerar `.env` al actualizar; conserva `APP_INSTANCE_ID` y las credenciales.
- Detener el servidor, respaldar SQL Server, reemplazar código, ejecutar `scripts/prepare_local.py` y reiniciar.
- No ejecutar downgrade sobre la base real: elimina las tablas de las fases posteriores.
- Migraciones hasta `849260142f05`; incluyen las recetas previas `168594c26fd1` y la nueva planificación.

El ZIP es una entrega de código fuente, no un ejecutable autónomo ni una copia de los datos. Contiene dependencias declaradas, migraciones, tests, assets, iniciadores y guías. La instalación actual del usuario permanece en su carpeta original.

## Ventas reales y punto de equilibrio

La migración `c7e92026a001` añade `product_prices` y `sales`. Las nuevas pantallas de precios y ventas alimentan el dashboard mensual de ventas reales, con IGV fijo del 18 %. Cada venta conserva precio, costo unitario de ingredientes y receta. La nómina mensual se considera fija; los conceptos se separan según su comportamiento fijo/variable. Fórmulas, supuestos y guía: [MEJORAS_COSTEA.md](../MEJORAS_COSTEA.md).

## Reglas del motor de planificación 1.0.0

### Personal base de los restaurantes

La pantalla Personal comienza con el catálogo compartido de trabajadores y contratos de Azure SQL (`CATALOGO-BASE`, restaurante `0`). Todos los restaurantes, incluidos los nuevos, ven esta lista inicial. Cada ficha presenta contratación, estados, jornada y descanso, hijos, vacaciones, beneficios, seguros, descuentos, parámetros y observaciones. Los costos proceden de las vistas laborales del SQL y se muestran en PEN; el equivalente mensual del desglose es el importe anual dividido entre doce. Los contratos inactivos conservan sus datos y muestran «Sin cálculo» cuando no tienen una proyección activa.

Editar crea una personalización del trabajador exclusivamente en el restaurante actual, con sus contratos, parámetros, hijos y calendarios. Sus registros SQL usan `COSTEA-PERSONAL` y el ID del restaurante; `restaurant_labor_profiles` conserva la relación con los códigos originales. El resto del catálogo continúa consultándose directamente. Eliminar registra la exclusión del trabajador en ese restaurante y elimina su copia personalizada, si existe. La lista base y los demás restaurantes conservan sus perfiles. Ambos formularios comprueban propiedad y CSRF; una ficha desactualizada debe recargarse antes de guardar. Las escrituras de cada operación son transaccionales.

La migración `h20261014012` añade la tabla de personalizaciones. En App Service, `prepare-labor-profiles` prepara esa tabla de forma idempotente antes de iniciar el servidor. No requiere volver a ejecutar el archivo SQL completo.

Los trabajadores adicionales y sus configuraciones mensuales se guardan por empresa. Esas configuraciones alimentan el motor de planes; mostrar el catálogo compartido no crea automáticamente registros mensuales ni gastos en las empresas. El modelo SQL actual no contiene estado civil.

Eliminar un trabajador adicional requiere confirmación y quita sus configuraciones mensuales y asignaciones a recetas de esa empresa. Los planes se marcan para recalcular; las instantáneas de presupuestos publicados se conservan.

### Cálculos y distribución

- Decimal desde cadenas, precisión de cálculo 28. Importes/medidas exactos como texto decimal; en JSON se guardan cadenas, nunca floats. No sumar columnas decimales de texto con SQL.
- PEN/USD/EUR tienen presentación monetaria de 2 decimales con ROUND_HALF_UP; los costos unitarios no se redondean antes de multiplicar.
- Materiales: (neto + impuesto no recuperable + adquisición adicional) / (cantidad × factor). Impuesto recuperable separado.
- Recetas: cantidades brutas, netas ajustadas por pérdida, o netas con adicional; modos excluyentes. La pérdida es menor que 100 %. Rendimiento positivo por lote.
- Las recetas eligen una versión explícita de precio. Cambiar el catálogo no sustituye automáticamente precios de recetas. La fecha de referencia del plan verifica que el precio elegido no sea futuro.
- Cada versión de receta tiene su configuración de operaciones y aplicabilidad. Al crear otra versión se debe revisar su trabajo; no se copian minutos silenciosamente a un lote con otro rendimiento.
- Personal: cinco grupos de componentes mensuales explícitos (remuneración, asignaciones, provisiones, cargas y otros) con sustento. No se calculan tasas legales. Costos y tiempo se distribuyen con los mismos porcentajes; suman 100 %.
- Minutos efectivos = (días × horas × 60 − exclusiones) × productividad. La tarifa MOD usa el costo y los minutos de la fracción MOD. Sin minutos y con costo no hay tarifa válida.
- Personal indirecto genera conceptos de origen único en el cálculo. No registrar otra vez su nómina en CIF/gastos. Los importes positivos sin base quedan sin asignar.
- CIF/gastos: reparto por producto destinatario, proporcional a unidades equivalentes, minutos MOD o ventas de referencia. La base de ventas es independiente del precio sugerido. Fijo/variable es descriptivo; no recalcula importes por volumen automáticamente.
- Redondeo de asignaciones por mayores restos y desempate estable; se conserva también el reparto completo. La conciliación general admite como máximo 0.00000001 de residuo por aritmética decimal finita, sin alterar importes monetarios presentados.
- Precio por recargo sobre costo, margen sobre venta neta o precio final manual. El precio final adoptado opcional reemplaza al sugerido. Se redondea a céntimos y se recalcula margen efectivo. Impuesto heredado del periodo o sobrescrito por línea del plan.
- Utilidad = ventas netas − CMP − MOD disponible − CIF − gastos. Se incluye MOD no absorbida; no se vuelve a sumar nómina indirecta.
- Producción igual a ventas, sin inventarios ni proceso, consumo proporcional de lotes. No se simulan corridas enteras ni horas extra gratis.
- Se bloquea publicar por datos faltantes, capacidad excedida, impuesto ausente, conceptos sin base o conciliación fallida.

## Históricos y concurrencia

El plan es el borrador. Recalcular guarda una huella de las entradas seleccionadas. La pantalla muestra una vista previa fresca, indicando si debe revisarse otra vez. Publicar valida la huella, recalcula y guarda una instantánea inmutable con recetas, precios y sus entradas, tiempos, costos de personal, impuestos, reglas, importes, resultados, autor y versión del motor.

Una nueva publicación del plan crea otra versión. Repetir la publicación sin cambios devuelve la existente. Archivar modifica un estado separado de la instantánea. La descarga JSON conserva cantidades y resultados exactos; no se ofrece importación automática de ese archivo.

SQL Server gestiona las transacciones y la concurrencia. La edición simultánea de formularios de personal, conceptos y planes sigue el criterio del último guardado; el editor de recetas usa además un contador de revisión.

## Arquitectura para próximas actualizaciones

- `app/models`: identidad, catálogos, recetas, personal mensual, planes y presupuestos.
- `app/forms`: límites y validaciones de entradas; relaciones se verifican contra la empresa.
- `app/services/recipes.py`, `materials.py`, `units.py`: cálculo de materiales y conversiones.
- `app/services/costing.py`: funciones puras de personal, asignación, precio y conciliación.
- `app/services/planning.py`: adaptación ORM, snapshot y huella; separada de las fórmulas.
- `app/routes/planning.py`: flujo transaccional, propiedad y publicación.
- `app/templates/planning`: formularios, cuadro, capacidad, reportes e históricos.
- `migrations`: evolución aditiva del esquema.
- `tests`: cálculos independientes y flujos aislados sin tocar datos reales.

Configuraciones mensuales y listas de operaciones pequeñas se guardan como JSON para esta versión base; los valores numéricos permanecen como cadenas decimales. No hay API pública. Las actualizaciones del catálogo y las consultas usan IDs validados por empresa.

## Pruebas

Pytest usa `.pytest-tmp` dentro de la carpeta desde la que se ejecuta,
para evitar errores de permisos en los temporales de Windows. Esa carpeta está
excluida de Git y se limpia en cada ejecución: reservarla únicamente para pruebas.
GitHub Actions conserva su ubicación explícita mediante `--basetemp`.

Desde `costos_app`:

```powershell
..\.venv\Scripts\python.exe -m pytest -q
..\.venv\Scripts\python.exe -m ruff check .
..\.venv\Scripts\python.exe -m ruff format --check .
..\.venv\Scripts\python.exe -m flask --app run db check
```

Incluyen los casos numéricos de conversión, merma/adicional, lotes, tarifa laboral, recursos mixtos, reparto por bases, márgenes/recargos, capacidad, mayores restos y conciliación completa; publicación, revisiones, snapshots inmutables, CSRF, relaciones ajenas, vigencias, moneda y migraciones de ida/vuelta en bases temporales. El caso integrado 800 unidades produce utilidad 3600 y margen 30 %, con MOD ociosa 400.

Las pruebas unitarias usan bases efímeras aisladas. La persistencia real requiere SQL Server y el controlador ODBC indicado en `.env.example`.

## Seguridad y configuración

Variables en `.env`: SECRET_KEY (mínimo 32 caracteres), APP_ENV, DATABASE_URL, RATELIMIT_STORAGE_URI y TRUSTED_HOSTS. El servidor local escucha solo 127.0.0.1, sin debugger. Contraseñas scrypt, CSRF en cambios, cookies HttpOnly/SameSite, sesión de 8 horas, límite de intentos y validación de propiedad.

No publicar este servidor directamente en Internet. Para despliegue se necesitan HTTPS, hosts confiables, almacenamiento compartido del limitador y copias automáticas. SQL administrativo directo queda fuera de los controles de inmutabilidad del ORM.

## Alcance excluido y siguientes mejoras

Sin facturación electrónica, SUNAT, planilla legal, contabilidad financiera oficial, inventarios/kardex, compras/POS, bancos, conversión de monedas, comisiones dependientes del precio, exportador Excel/PDF dedicado, recuperación de contraseñas ni comparación real/presupuesto. La impresión usa el navegador; Reportes muestra el plan activo y presupuestos publicados conservan sus resultados.

Prioridades futuras: menos campos por pantalla, duplicación de escenarios/meses, exportaciones, editor flexible de componentes laborales, auditoría de ediciones y concurrencia amplia. Este motor gerencial no afirma cumplimiento tributario ni valoración contable de inventarios.

Bootstrap 5.3.3 y Bootstrap Icons 1.11.3 se incluyen localmente con sus licencias MIT. No se incorporan fotos ni recursos externos.
# Integración del Excel de restaurantes

Consulta [MEJORAS_EXCEL.md](MEJORAS_EXCEL.md) para los modelos, fórmulas, campos nuevos y pantallas de planilla y Food Cost.
