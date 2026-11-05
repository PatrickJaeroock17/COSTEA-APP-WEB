-- Ejecutar en SSMS con Consulta > Modo SQLCMD activado.
-- Variante para la base existente de la aplicacion Costea.
-- Se detiene en el primer error. Probar primero en una copia de la base.
:ON ERROR EXIT
IF DB_NAME() NOT IN (N'Costea_Cevicheria', N'Costea_Cevicheria_prueba')
    THROW 51000, N'Base incorrecta: este script requiere Costea_Cevicheria o Costea_Cevicheria_prueba.', 1;
IF OBJECT_ID(N'dbo.insumos', N'U') IS NULL
    OR OBJECT_ID(N'dbo.categorias', N'U') IS NULL
    OR OBJECT_ID(N'dbo.unidades_medida', N'U') IS NULL
    THROW 51001, N'Falta el catalogo existente de Costea; no ejecutar sobre una base vacia.', 1;
IF COL_LENGTH(N'dbo.insumos', N'codigo_comercial') IS NULL
    THROW 51002, N'Falta codigo_comercial; revisa las migraciones de la aplicacion antes de continuar.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.insumos)
    THROW 51003, N'El catalogo actual esta vacio; no ejecutar esta variante.', 1;
GO

-- STOCK DE APERTURA AÑADIDO: escenario de 60 comensales/día, con reserva de 10%.
-- Sección 7: stock_inicial por kg/L, calculado de recetas y mínimos de servicio.
-- Valores estimados de planificación. Los perecibles requieren reposición y
-- cadena de frío; días de compra no representan fechas de vencimiento.
-- Ejecutar completo en SQL Server: inicializa solo cantidades aún NULL.
-- Las cantidades de apertura ya definidas se preservan al volver a ejecutar.

-- ============================================================================
-- REVISIÓN DE PRECIOS REFERENCIALES: LIMA / 13 DE OCTUBRE DE 2026
-- Moneda: PEN. Valores por kg o por litro según unidades_medida.
-- Escenario: cevichería MEDIANA en Lima, un local; compras a terminales,
-- mercados mayoristas y distribuidores. Abarrotes en sacos/envases de negocio.
-- No presupone descuentos de una gran cadena. Se conservan las especies de
-- las recetas (corvina no se sustituye por otro pescado más económico).
-- Este archivo combina referencias publicadas con estimaciones de trabajo.
-- NO es una lista de 500 cotizaciones mayoristas verificadas.
-- REFERENCIA_PUBLICADA = dato publicado normalizado a la unidad base; puede
--   ser mayorista, proveedor por volumen o minorista. Revisar fuente y nota.
-- ESTIMADO = hipótesis para simulación; NO es un precio verificado del proveedor.
-- ORIGINAL_SIN_VALIDAR = original conservado sin validación externa comparable.
-- Mantiene tablas, identificadores, recetas, cantidades y mermas del archivo.
-- La sección 6 actualiza los precios incluso si la base YA existe. Al volver a
-- ejecutar este archivo se reaplican estos valores de referencia.
-- Los catálogos sin fecha no garantizan disponibilidad ni vigencia diaria.
-- Transporte no incluido. IGV según publicación; no se descuenta de los datos.
-- Sección 6: revisa precio_mayorista y fecha_actualizacion.
-- Sección 7: añade stock_inicial y lo completa solo si está NULL.
-- Precio de atún enlatado usado como kg escurrido: hipótesis documentada abajo.
-- Leche evaporada y salsa de ostión: conversión masa-volumen estimada, no 1:1.
-- ============================================================================
-- Revisión: 446 precios diferentes; 54 valores numéricos conservados.
-- Clasificación: ESTIMADO=375, ORIGINAL_SIN_VALIDAR=24, REFERENCIA_PUBLICADA=101.
-- FUENTES (consulta 13/10/2026; fecha del precio solo cuando publicada):
-- F01: DePeru: referencias agrícolas mayoristas de Lima. Fecha: 2026-10-12.
-- https://www.deperu.com/precios/agricolas.php
-- F02: Pycmar: filete de pota en bloques. Fecha: no indicada en catálogo.
-- https://www.pycmarperu.com/catalogo/filete
-- F03: Pycmar: tentáculos de pota limpios. Fecha: no indicada en catálogo.
-- https://www.pycmarperu.com/catalogo/tentaculos
-- F04: Pycmar: pulpo entero congelado. Fecha: no indicada en catálogo.
-- https://www.pycmarperu.com/catalogo/pulpo
-- F05: Pycmar: calamar Loligo entero. Fecha: no indicada en catálogo.
-- https://www.pycmarperu.com/catalogo/loligo
-- F06: Pycmar: concha de abanico, varias presentaciones. Fecha: no indicada en catálogo.
-- https://www.pycmarperu.com/catalogo/concha
-- F07: ICO: pescados y mariscos. Fecha: no indicada en catálogo.
-- https://ico.pe/para-tu-hogar/pescados-y-mariscos/
-- F08: ICO: aceite vegetal y oliva para negocios. Fecha: no indicada en catálogo.
-- https://ico.pe/para-tu-negocio/abarrotes/aceites-y-vinagres/
-- F09: ICO: mayonesa base de 4 kg. Fecha: no indicada en catálogo.
-- https://ico.pe/producto/mayonesa-base-paraiso-caja-x-4-kg/
-- F10: ICO Market: parmesano rallado de 500 g. Fecha: no indicada en catálogo.
-- https://icomarket.pe/producto/queso-parmesano-rallado-ico-foods-x-500gr
-- F11: ICO: mantequillas. Fecha: no indicada en catálogo.
-- https://ico.pe/para-tu-hogar/lacteos-y-huevos/mantequillas/
-- F12: Makro: arroz superior en sacos. Fecha: no indicada en catálogo.
-- https://www.makro.plazavea.com.pe/abarrotes/superior
-- F13: ICO: arroz extra de 50 kg. Fecha: no indicada en catálogo.
-- https://ico.pe/producto/arroz-campero-granel-reserva-extra-50kg/
-- F14: ICO: azúcar para negocios. Fecha: no indicada en catálogo.
-- https://ico.pe/para-tu-negocio/abarrotes/azucares/
-- F15: ICO: sillao botella de 1 litro. Fecha: no indicada en catálogo.
-- https://ico.pe/producto/aji-no-sillao-botella-x-1-lt/
-- F16: ICO: salsa de ostión en distintas presentaciones. Fecha: no indicada en catálogo.
-- https://ico.pe/para-tu-hogar/abarrotes/salsas-y-cremas/
-- F17: Makro: comino y pimienta ARO de 500 g. Fecha: no indicada en catálogo.
-- https://www.makro.plazavea.com.pe/abarrotes/salsas-cremas-y-condimentos/aro/rico/plazaVea?PS=20&map=c%2Cc%2Cb%2Cb%2CspecificationFilter_7581
-- F18: ICO: atún en conserva 140 g. Fecha: no indicada en catálogo.
-- https://ico.pe/producto/filete-de-atun-en-aceite-vegetal-y-sal-gloria-x-140gr/
-- F19: Makro: leche evaporada comparada por Nada Menos. Fecha: 2026-10-11.
-- https://nadamenos.pe/producto/leche-evaporada-entera-gloria-lata-390g-paquete-6un-vivanda-p23279
-- F20: RPP: peces del terminal de Chorrillos; referencia histórica. Fecha: 2026-09-05.
-- https://rpp.pe/lima/actualidad/chorrillos-reportan-escasez-de-pejerrey-y-lorna-en-terminal-pesquero-por-fenomeno-el-nino-noticia-1705748
-- F21: Seafrost/Rappi: corvina en filete, canal minorista. Fecha: no indicada en catálogo.
-- https://www.rappi.com.pe/tiendas/8595-sea-frost-lima/pescados-y-mariscos/pescados-y-mariscos
-- F22: Vivanda: sal de mesa de 1 kg, canal minorista. Fecha: no indicada en catálogo.
-- https://www.vivanda.com.pe/sal-de-mesa-bells-bolsa-1-kg/p
-- F23: Licores Nuevo Mundo: angostura 200 ml, canal minorista. Fecha: no indicada en catálogo.
-- https://www.licoresnuevomundo.pe/product/angostura-aromatic-bitters-x-200ml
-- F24: Makro: filete de pechuga SADIA de 1 kg. Fecha: no indicada en catálogo.
-- https://www.makro.plazavea.com.pe/carnes-aves-y-pescados/pollo/cortes-y-filetes-de-pollo/sadia?PS=20
-- F25: Alimentos Cielo: harina panadera de 50 kg. Fecha: no indicada en catálogo.
-- https://alimentoscielo.com/p/harina-especial-panadera-del-cielo-50-kg/
-- F26: ICO: salsas y cremas, envases de 4 kg. Fecha: no indicada en catálogo.
-- https://ico.pe/producto/mayonesa-base-paraiso-caja-x-4-kg/
-- F27: Delivemas: sal de mesa EMSAL de 1 kg. Fecha: no indicada en catálogo.
-- https://delivemas.fac.pe/en_US/shop/category/especias-salsas-y-condimentos-sal-148?order=list_price+asc

-- ============================================================================
-- COSTEA · Cevichería peruana · Script unificado (SQL Server 2016 SP1 o superior)
-- Base de datos: Insumos_Cevicheria
--
-- Contenido:
--   1. Catálogo original (categorias, unidades_medida, insumos + vista_insumos)
--   2. Tabla platos (se conserva la estructura existente y se AGREGAN columnas
--      de precio de venta y márgenes, nulables / 0 por defecto)
--   3. Tabla receta_detalles (plato <-> insumo con cantidad exacta)
--   4. Vistas de costeo estándar (referencia; la web puede calcular por su cuenta)
--   5. Catálogo base de 20 platos con su receta estándar
--   6. Actualización documentada de precios para bases nuevas o existentes
--   7. Stock inicial para una cevichería mediana y vista de inventario de apertura
--   8. Personal simulado y cálculo integral de costos laborales
--
-- Es re-ejecutable: los objetos y datos iniciales se crean si no existen;
-- la sección 6 reaplica los precios revisados cada vez que se ejecuta.
-- Los platos existentes se conservan,
-- y las recetas solo se cargan en platos que todavía no tienen líneas.
-- Ejecutar completo en SSMS, Azure Data Studio o sqlcmd (usa GO y USE).
--
-- CONVENCIONES DE receta_detalles
--   cantidad             Cantidad NETA que lleva la receta completa (porciones del plato),
--                        expresada en unidad_receta.
--   unidad_receta        'g', 'kg', 'ml', 'l' o 'unid'.
--   factor_a_unidad_base Multiplicador para pasar cantidad a la unidad del insumo
--                        (kg o Litro): g y ml = 0.001 ; kg y l = 1 ;
--                        unid = peso (kg) de una unidad (limón sutil 0.025, huevo 0.060).
--   merma_pct            % perdido en limpieza/cocción sobre lo comprado (0 a <100).
--   cantidad_base        (calculada) cantidad * factor_a_unidad_base.
--   Costo de una línea = cantidad_base / (1 - merma_pct/100) * insumos.precio_mayorista
--   Costo por porción  = suma de líneas / platos.porciones
-- ============================================================================

SET NOCOUNT ON;
GO


SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================================
-- 1. CATÁLOGO (misma estructura; precios referenciales revisados)
-- ============================================================================
IF OBJECT_ID(N'dbo.categorias', N'U') IS NULL
    CREATE TABLE dbo.categorias (
        id_categoria INT IDENTITY(1,1) PRIMARY KEY,
        nombre NVARCHAR(100) NOT NULL UNIQUE
    );
GO

IF OBJECT_ID(N'dbo.unidades_medida', N'U') IS NULL
    CREATE TABLE dbo.unidades_medida (
        id_unidad INT IDENTITY(1,1) PRIMARY KEY,
        codigo NVARCHAR(20) NOT NULL UNIQUE,
        descripcion NVARCHAR(100) NULL
    );
GO

IF OBJECT_ID(N'dbo.insumos', N'U') IS NULL
    CREATE TABLE dbo.insumos (
        id_insumo INT IDENTITY(1,1) PRIMARY KEY,
        nombre NVARCHAR(100) NOT NULL,
        variedad NVARCHAR(100) NULL,
        id_categoria INT NULL,
        id_unidad INT NOT NULL,
        precio_mayorista DECIMAL(10,2) NOT NULL,
        fecha_actualizacion DATETIME NOT NULL DEFAULT GETDATE(),
        activo BIT NOT NULL DEFAULT 1,
        CONSTRAINT FK_insumos_categoria FOREIGN KEY (id_categoria) REFERENCES dbo.categorias(id_categoria),
        CONSTRAINT FK_insumos_unidad FOREIGN KEY (id_unidad) REFERENCES dbo.unidades_medida(id_unidad),
        CONSTRAINT UQ_insumos_nombre_variedad_unidad UNIQUE (nombre, variedad, id_unidad)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_insumos_nombre' AND object_id = OBJECT_ID(N'dbo.insumos'))
    CREATE INDEX idx_insumos_nombre ON dbo.insumos(nombre);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_insumos_categoria' AND object_id = OBJECT_ID(N'dbo.insumos'))
    CREATE INDEX idx_insumos_categoria ON dbo.insumos(id_categoria);
GO

-- Categorías
IF NOT EXISTS (SELECT 1 FROM dbo.categorias)
BEGIN
    SET IDENTITY_INSERT dbo.categorias ON;
    INSERT INTO dbo.categorias (id_categoria, nombre) VALUES (1, 'Abarrotes, Granos y Condimentos');
    INSERT INTO dbo.categorias (id_categoria, nombre) VALUES (2, 'Bebidas');
    INSERT INTO dbo.categorias (id_categoria, nombre) VALUES (3, 'Carnes y Aves');
    INSERT INTO dbo.categorias (id_categoria, nombre) VALUES (4, 'Frutas');
    INSERT INTO dbo.categorias (id_categoria, nombre) VALUES (5, 'Hierbas y Especias');
    INSERT INTO dbo.categorias (id_categoria, nombre) VALUES (6, 'Lácteos y Huevos');
    INSERT INTO dbo.categorias (id_categoria, nombre) VALUES (7, 'Mariscos y Algas');
    INSERT INTO dbo.categorias (id_categoria, nombre) VALUES (8, 'Pescados');
    INSERT INTO dbo.categorias (id_categoria, nombre) VALUES (9, 'Verduras y Hortalizas');
    SET IDENTITY_INSERT dbo.categorias OFF;
END
GO

-- Unidades de medida
IF NOT EXISTS (SELECT 1 FROM dbo.unidades_medida)
BEGIN
    SET IDENTITY_INSERT dbo.unidades_medida ON;
    INSERT INTO dbo.unidades_medida (id_unidad, codigo, descripcion) VALUES (1, 'Litro', 'Litro');
    INSERT INTO dbo.unidades_medida (id_unidad, codigo, descripcion) VALUES (2, 'kg', 'Kilogramo');
    SET IDENTITY_INSERT dbo.unidades_medida OFF;
END
GO

-- Insumos (500 registros)
IF NOT EXISTS (SELECT 1 FROM dbo.insumos)
BEGIN
    SET IDENTITY_INSERT dbo.insumos ON;
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (1, 'Corvina', 'Filete', 8, 2, 75.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (2, 'Corvina', 'Entera', 8, 2, 40.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (3, 'Lenguado', 'Filete', 8, 2, 90.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (4, 'Lenguado', 'Entero', 8, 2, 55.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (5, 'Pejerrey', 'Entero', 8, 2, 14.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (6, 'Pejerrey', 'Filete', 8, 2, 26.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (7, 'Bonito', 'Entero', 8, 2, 8.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (8, 'Bonito', 'Filete', 8, 2, 16.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (9, 'Jurel', 'Entero', 8, 2, 7.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (10, 'Jurel', 'Filete', 8, 2, 14.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (11, 'Caballa', 'Entera', 8, 2, 6.50, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (12, 'Caballa', 'Filete', 8, 2, 13.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (13, 'Cabrilla', 'Entera', 8, 2, 25.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (14, 'Cabrilla', 'Filete', 8, 2, 45.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (15, 'Cojinova', 'Entera', 8, 2, 20.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (16, 'Cojinova', 'Filete', 8, 2, 36.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (17, 'Mero', 'Filete', 8, 2, 75.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (18, 'Merluza', 'Filete', 8, 2, 18.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (19, 'Perico', 'Filete', 8, 2, 30.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (20, 'Tollo', 'Filete', 8, 2, 22.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (21, 'Pota', 'Filete', 7, 2, 14.00, 1); -- REFERENCIA_PUBLICADA; F02
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (22, 'Pota', 'Tentáculos', 7, 2, 13.50, 1); -- REFERENCIA_PUBLICADA; F03
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (23, 'Atún', 'Filete', 8, 2, 45.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (24, 'Atún', 'Lomo aleta amarilla', 8, 2, 55.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (25, 'Salmón', 'Filete', 8, 2, 65.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (26, 'Trucha', 'Entera', 8, 2, 18.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (27, 'Trucha', 'Filete', 8, 2, 32.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (28, 'Tilapia', 'Entera', 8, 2, 12.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (29, 'Tilapia', 'Filete', 8, 2, 19.90, 1); -- REFERENCIA_PUBLICADA; F07
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (30, 'Paiche', 'Filete', 8, 2, 45.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (31, 'Doncella', 'Filete', 8, 2, 36.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (32, 'Lisa', 'Entera', 8, 2, 8.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (33, 'Chita', 'Entera', 8, 2, 28.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (34, 'Lorna', 'Entera', 8, 2, 12.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (35, 'Pintadilla', 'Entera', 8, 2, 18.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (36, 'Robalo', 'Filete', 8, 2, 50.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (37, 'Machete', 'Entero', 8, 2, 9.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (38, 'Anchoveta', 'Entera', 8, 2, 5.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (39, 'Sardina', 'Entera', 8, 2, 6.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (40, 'Cachema', 'Entera', 8, 2, 14.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (41, 'Congrio', 'Filete', 8, 2, 38.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (42, 'Pámpano', 'Entero', 8, 2, 28.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (43, 'Cabeza de pescado', 'Para fumet', 8, 2, 4.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (44, 'Espinas de pescado', 'Para fumet', 8, 2, 3.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (45, 'Conchas negras', 'Con valva', 7, 2, 25.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (46, 'Conchas negras', 'Pulpa', 7, 2, 70.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (47, 'Conchas de abanico', 'Con coral', 7, 2, 50.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (48, 'Conchas de abanico', 'Sin coral', 7, 2, 60.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (49, 'Pulpo', 'Entero', 7, 2, 33.00, 1); -- REFERENCIA_PUBLICADA; F04
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (50, 'Pulpo', 'Tentáculos', 7, 2, 42.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (51, 'Calamar', 'Tubo', 7, 2, 25.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (52, 'Calamar', 'Anillas', 7, 2, 28.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (53, 'Calamar', 'Entero', 7, 2, 22.00, 1); -- REFERENCIA_PUBLICADA; F05
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (54, 'Camarón', 'Mediano', 7, 2, 42.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (55, 'Camarón', 'Jumbo', 7, 2, 60.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (56, 'Camarón', 'Pelado', 7, 2, 55.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (57, 'Langostino', 'Entero', 7, 2, 28.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (58, 'Langostino', 'Cola pelada', 7, 2, 39.90, 1); -- REFERENCIA_PUBLICADA; F07
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (59, 'Cangrejo', 'Peludo', 7, 2, 25.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (60, 'Cangrejo', 'Violáceo', 7, 2, 22.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (61, 'Cangrejo', 'Pulpa', 7, 2, 75.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (62, 'Cangrejo', 'Pinza', 7, 2, 45.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (63, 'Choros', 'Con valva', 7, 2, 8.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (64, 'Choros', 'Pulpa', 7, 2, 25.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (65, 'Almejas', 'Con valva', 7, 2, 18.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (66, 'Machas', 'Con valva', 7, 2, 30.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (67, 'Navajas', 'Con valva', 7, 2, 30.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (68, 'Erizo', 'Lengua', 7, 2, 65.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (69, 'Langosta', 'Entera', 7, 2, 100.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (70, 'Caracol', 'Cocido', 7, 2, 35.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (71, 'Ostión', 'Con valva', 7, 2, 45.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (72, 'Picoroco', 'Pulpa', 7, 2, 25.00, 1); -- ORIGINAL_SIN_VALIDAR; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (73, 'Jaiba', 'Entera', 7, 2, 28.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (74, 'Camarón de río', 'Entero', 7, 2, 45.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (75, 'Chanque', 'Pulpa', 7, 2, 28.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (76, 'Huevas de pescado', 'Frescas', 8, 2, 35.00, 1); -- ESTIMADO; F04/F05/F06/F07/F20/F21
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (77, 'Mixtura de mariscos', 'Congelada', 7, 2, 36.05, 1); -- REFERENCIA_PUBLICADA; F07
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (78, 'Res', 'Lomo fino', 3, 2, 65.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (79, 'Res', 'Bistec / Pulpa', 3, 2, 32.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (80, 'Res', 'Carne molida', 3, 2, 27.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (81, 'Res', 'Corazón (anticucho)', 3, 2, 16.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (82, 'Res', 'Hígado', 3, 2, 14.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (83, 'Res', 'Costilla', 3, 2, 24.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (84, 'Res', 'Asado de tira', 3, 2, 35.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (85, 'Res', 'Cabeza de lomo', 3, 2, 38.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (86, 'Res', 'Falda', 3, 2, 26.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (87, 'Res', 'Osobuco', 3, 2, 23.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (88, 'Res', 'Rabo', 3, 2, 24.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (89, 'Res', 'Lengua', 3, 2, 28.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (90, 'Res', 'Panza / Mondongo', 3, 2, 15.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (91, 'Res', 'Pecho', 3, 2, 25.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (92, 'Res', 'Chuleta T-bone', 3, 2, 48.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (93, 'Res', 'Bife ancho', 3, 2, 50.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (94, 'Res', 'Huesos para caldo', 3, 2, 6.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (95, 'Res', 'Charqui', 3, 2, 70.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (96, 'Res', 'Callos', 3, 2, 16.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (97, 'Res', 'Pulpa para guiso', 3, 2, 30.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (98, 'Pollo', 'Entero', 3, 2, 9.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (99, 'Pollo', 'Pechuga', 3, 2, 14.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (100, 'Pollo', 'Pierna / Encuentro', 3, 2, 11.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (101, 'Pollo', 'Ala', 3, 2, 12.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (102, 'Pollo', 'Filete de pechuga', 3, 2, 14.90, 1); -- REFERENCIA_PUBLICADA; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (103, 'Pollo', 'Molleja / Menudencia', 3, 2, 9.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (104, 'Pollo', 'Hígado', 3, 2, 7.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (105, 'Pollo', 'Carcasa / Huesos', 3, 2, 3.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (106, 'Pavo', 'Entero', 3, 2, 18.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (107, 'Pavo', 'Pechuga', 3, 2, 28.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (108, 'Pato', 'Entero', 3, 2, 30.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (109, 'Gallina', 'Entera', 3, 2, 18.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (110, 'Cerdo', 'Chuleta', 3, 2, 20.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (111, 'Cerdo', 'Pulpa', 3, 2, 20.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (112, 'Cerdo', 'Tocino', 3, 2, 26.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (113, 'Cerdo', 'Costilla', 3, 2, 25.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (114, 'Cerdo', 'Panceta', 3, 2, 25.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (115, 'Cerdo', 'Pierna', 3, 2, 18.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (116, 'Cerdo', 'Chicharrón (panza)', 3, 2, 23.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (117, 'Cerdo', 'Cuero', 3, 2, 9.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (118, 'Cordero', 'Pierna', 3, 2, 32.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (119, 'Cordero', 'Costillar', 3, 2, 38.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (120, 'Cabrito', 'Pierna', 3, 2, 35.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (121, 'Cuy', 'Entero', 3, 2, 40.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (122, 'Conejo', 'Entero', 3, 2, 30.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (123, 'Alpaca', 'Lomo', 3, 2, 38.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (124, 'Jamón', 'Del país', 3, 2, 28.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (125, 'Jamón', 'Inglés', 3, 2, 35.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (126, 'Jamonada', 'Corriente', 3, 2, 18.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (127, 'Chorizo', 'Parrillero', 3, 2, 28.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (128, 'Salchicha', 'Huachana', 3, 2, 25.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (129, 'Salchicha', 'Hot dog', 3, 2, 16.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (130, 'Tocino', 'Ahumado', 3, 2, 38.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (131, 'Pepperoni', 'Rebanado', 3, 2, 50.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (132, 'Mortadela', 'Corriente', 3, 2, 22.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (133, 'Longaniza', 'Corriente', 3, 2, 26.00, 1); -- ESTIMADO; F24
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (134, 'Arroz', 'Superior (Costa)', 1, 2, 3.37, 1); -- REFERENCIA_PUBLICADA; F12
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (135, 'Arroz', 'Corriente (Costa)', 1, 2, 3.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (136, 'Arroz', 'Extra (Costa)', 1, 2, 4.38, 1); -- REFERENCIA_PUBLICADA; F13
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (137, 'Arroz', 'Superior (Selva)', 1, 2, 3.20, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (138, 'Arroz', 'Integral', 1, 2, 6.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (139, 'Arroz', 'Arborio (risotto)', 1, 2, 18.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (140, 'Arroz', 'Grano largo', 1, 2, 4.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (141, 'Frijol', 'Canario', 9, 2, 8.50, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (142, 'Frijol', 'Castilla', 9, 2, 7.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (143, 'Frijol', 'Panamito', 9, 2, 9.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (144, 'Frijol', 'Negro', 9, 2, 9.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (145, 'Frijol', 'Caballero', 9, 2, 8.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (146, 'Frijol', 'Bayo', 9, 2, 8.50, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (147, 'Lentejas', 'Bebé', 9, 2, 6.50, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (148, 'Lentejas', 'Serrana', 9, 2, 7.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (149, 'Garbanzo', 'Seco', 9, 2, 9.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (150, 'Pallares', 'Seco', 9, 2, 10.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (151, 'Quinua', 'Blanca', 9, 2, 10.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (152, 'Quinua', 'Roja', 9, 2, 12.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (153, 'Quinua', 'Negra', 9, 2, 13.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (154, 'Maíz', 'Choclo desgranado', 1, 2, 8.50, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (155, 'Maíz', 'Morado', 1, 2, 3.65, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (156, 'Maíz', 'Cancha serrana', 1, 2, 5.50, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (157, 'Maíz', 'Chulpi', 1, 2, 6.50, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (158, 'Maíz', 'Mote', 1, 2, 6.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (159, 'Maíz', 'Canchita (reventón)', 1, 2, 6.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (160, 'Maíz', 'Tostado', 1, 2, 9.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (161, 'Trigo', 'Grano', 1, 2, 4.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (162, 'Cebada', 'Perlada', 1, 2, 4.50, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (163, 'Kiwicha', 'Grano', 9, 2, 11.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (164, 'Avena', 'Hojuelas', 1, 2, 6.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (165, 'Papa', 'Amarilla', 9, 2, 4.10, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (166, 'Papa', 'Canchán', 9, 2, 2.11, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (167, 'Papa', 'Blanca', 9, 2, 1.25, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (168, 'Papa', 'Huayro', 9, 2, 2.90, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (169, 'Papa', 'Peruanita', 9, 2, 2.35, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (170, 'Papa', 'Nativa', 9, 2, 3.50, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (171, 'Papa', 'Yungay', 9, 2, 1.25, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (172, 'Papa', 'Perricholi', 9, 2, 1.80, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (173, 'Papa', 'Prefrita congelada', 9, 2, 10.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (174, 'Papa', 'Seca', 9, 2, 13.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (175, 'Camote', 'Amarillo', 9, 2, 1.49, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (176, 'Camote', 'Morado', 9, 2, 1.73, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (177, 'Camote', 'Anaranjado', 9, 2, 1.80, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (178, 'Yuca', 'Blanca', 9, 2, 2.20, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (179, 'Yuca', 'Congelada', 9, 2, 7.50, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (180, 'Olluco', 'Amarillo', 9, 2, 4.28, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (181, 'Oca', 'Corriente', 9, 2, 4.00, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (182, 'Arracacha', 'Corriente', 9, 2, 4.50, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (183, 'Chuño', 'Negro', 9, 2, 12.00, 1); -- ORIGINAL_SIN_VALIDAR; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (184, 'Cebolla', 'Roja', 9, 2, 2.75, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (185, 'Cebolla', 'Blanca', 9, 2, 2.48, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (186, 'Cebolla china', 'Verde', 9, 2, 3.88, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (187, 'Puerro', 'Fresco', 9, 2, 3.27, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (188, 'Ajo', 'Nacional pelado', 9, 2, 6.13, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (189, 'Ajo', 'Cabeza entera', 9, 2, 4.00, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (190, 'Ajo', 'Molido', 9, 2, 9.00, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (191, 'Tomate', 'Italiano', 9, 2, 4.50, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (192, 'Tomate', 'Cherry', 9, 2, 6.25, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (193, 'Tomate', 'Pera', 9, 2, 4.20, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (194, 'Zanahoria', 'Corriente', 9, 2, 2.47, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (195, 'Zanahoria', 'Baby', 9, 2, 6.50, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (196, 'Lechuga', 'Americana', 9, 2, 1.54, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (197, 'Lechuga', 'Crespa', 9, 2, 2.50, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (198, 'Lechuga', 'Romana', 9, 2, 1.79, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (199, 'Lechuga', 'Hidropónica', 9, 2, 3.50, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (200, 'Apio', 'Corriente', 9, 2, 4.67, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (201, 'Pimiento', 'Rojo', 9, 2, 4.58, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (202, 'Pimiento', 'Verde', 9, 2, 4.00, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (203, 'Pimiento', 'Amarillo', 9, 2, 5.50, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (204, 'Brócoli', 'Corriente', 9, 2, 3.68, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (205, 'Coliflor', 'Corriente', 9, 2, 1.11, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (206, 'Espinaca', 'Fresca', 9, 2, 1.75, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (207, 'Vainita', 'Fresca', 9, 2, 4.08, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (208, 'Beterraga', 'Corriente', 9, 2, 2.87, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (209, 'Pepino', 'Corriente', 9, 2, 1.67, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (210, 'Repollo', 'Verde', 9, 2, 1.10, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (211, 'Repollo', 'Morado', 9, 2, 2.20, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (212, 'Choclo', 'Mazorca', 9, 2, 5.08, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (213, 'Arveja', 'Verde en vaina', 9, 2, 6.50, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (214, 'Arveja', 'Pelada', 9, 2, 13.00, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (215, 'Zapallo', 'Macre', 9, 2, 1.78, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (216, 'Zapallo', 'Loche', 9, 2, 5.42, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (217, 'Zapallito', 'Italiano', 9, 2, 1.40, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (218, 'Berenjena', 'Corriente', 9, 2, 6.30, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (219, 'Nabo', 'Corriente', 9, 2, 2.75, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (220, 'Rabanito', 'Rojo', 9, 2, 4.57, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (221, 'Alcachofa', 'Fresca', 9, 2, 5.63, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (222, 'Espárrago', 'Verde', 9, 2, 7.00, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (223, 'Champiñón', 'Fresco', 9, 2, 10.00, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (224, 'Col china', 'Corriente', 9, 2, 7.19, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (225, 'Acelga', 'Fresca', 9, 2, 3.75, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (226, 'Habas', 'Verdes en vaina', 9, 2, 1.20, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (227, 'Habas', 'Peladas', 9, 2, 5.00, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (228, 'Col de Bruselas', 'Fresca', 9, 2, 12.00, 1); -- ORIGINAL_SIN_VALIDAR; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (229, 'Brotes de soya', 'Frescos', 9, 2, 2.50, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (230, 'Palmito', 'Fresco', 9, 2, 25.00, 1); -- ORIGINAL_SIN_VALIDAR; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (231, 'Kale', 'Col rizada', 9, 2, 8.00, 1); -- ORIGINAL_SIN_VALIDAR; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (232, 'Yuyo', 'Alga fresca', 7, 2, 20.00, 1); -- ORIGINAL_SIN_VALIDAR; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (233, 'Cochayuyo', 'Alga seca', 7, 2, 30.00, 1); -- ORIGINAL_SIN_VALIDAR; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (234, 'Ají', 'Amarillo fresco', 9, 2, 5.65, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (235, 'Ají', 'Amarillo pulpa congelada', 9, 2, 12.00, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (236, 'Ají', 'Amarillo molido', 9, 2, 14.00, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (237, 'Ají', 'Limo', 9, 2, 10.00, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (238, 'Ají', 'Rocoto', 9, 2, 4.58, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (239, 'Ají', 'Panca seco', 9, 2, 16.63, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (240, 'Ají', 'Panca molido', 9, 2, 20.00, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (241, 'Ají', 'Mirasol seco', 9, 2, 17.00, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (242, 'Ají', 'Charapita', 9, 2, 60.00, 1); -- ORIGINAL_SIN_VALIDAR; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (243, 'Ají', 'Cerezo', 9, 2, 10.00, 1); -- ORIGINAL_SIN_VALIDAR; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (244, 'Ají', 'Pipí de mono', 9, 2, 35.00, 1); -- ORIGINAL_SIN_VALIDAR; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (245, 'Ají', 'Verde jalapeño', 9, 2, 6.00, 1); -- ORIGINAL_SIN_VALIDAR; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (246, 'Culantro', 'Fresco', 5, 2, 3.17, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (247, 'Perejil', 'Crespo', 5, 2, 2.70, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (248, 'Perejil', 'Liso', 5, 2, 3.00, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (249, 'Huacatay', 'Fresco', 5, 2, 2.98, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (250, 'Huacatay', 'Pasta', 5, 2, 18.00, 1); -- ORIGINAL_SIN_VALIDAR; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (251, 'Hierbabuena', 'Fresca', 5, 2, 2.09, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (252, 'Albahaca', 'Fresca', 5, 2, 4.93, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (253, 'Romero', 'Fresco', 5, 2, 9.25, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (254, 'Tomillo', 'Fresco', 5, 2, 22.00, 1); -- ORIGINAL_SIN_VALIDAR; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (255, 'Orégano', 'Fresco', 5, 2, 12.17, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (256, 'Menta', 'Fresca', 5, 2, 11.13, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (257, 'Kión', 'Fresco', 5, 2, 3.18, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (258, 'Cúrcuma', 'Fresca', 5, 2, 10.00, 1); -- ORIGINAL_SIN_VALIDAR; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (259, 'Hierba luisa', 'Fresca', 5, 2, 1.81, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (260, 'Chincho', 'Fresco', 5, 2, 12.00, 1); -- ORIGINAL_SIN_VALIDAR; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (261, 'Muña', 'Fresca', 5, 2, 8.00, 1); -- ORIGINAL_SIN_VALIDAR; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (262, 'Paico', 'Fresco', 5, 2, 6.00, 1); -- ORIGINAL_SIN_VALIDAR; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (263, 'Cebollino', 'Fresco', 9, 2, 8.00, 1); -- ORIGINAL_SIN_VALIDAR; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (264, 'Eneldo', 'Fresco', 5, 2, 20.00, 1); -- ORIGINAL_SIN_VALIDAR; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (265, 'Limón', 'Sutil', 4, 2, 3.00, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (266, 'Limón', 'Tahití', 4, 2, 3.50, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (267, 'Palta', 'Hass', 9, 2, 8.50, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (268, 'Palta', 'Fuerte', 9, 2, 7.63, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (269, 'Plátano', 'De seda', 4, 2, 2.07, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (270, 'Plátano', 'Verde (freír)', 4, 2, 2.80, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (271, 'Plátano', 'Isla', 4, 2, 2.73, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (272, 'Plátano', 'Bellaco', 4, 2, 3.20, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (273, 'Naranja', 'De jugo', 4, 2, 1.80, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (274, 'Naranja', 'De mesa', 4, 2, 3.00, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (275, 'Mandarina', 'Corriente', 4, 2, 2.98, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (276, 'Toronja', 'Corriente', 4, 2, 6.50, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (277, 'Maracuyá', 'Corriente', 4, 2, 4.38, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (278, 'Piña', 'Golden', 4, 2, 2.10, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (279, 'Papaya', 'Corriente', 4, 2, 3.70, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (280, 'Fresa', 'Fresca', 4, 2, 9.00, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (281, 'Mango', 'Kent', 4, 2, 6.50, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (282, 'Mango', 'Criollo', 4, 2, 7.63, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (283, 'Manzana', 'Delicia', 4, 2, 4.75, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (284, 'Manzana', 'Verde Granny', 4, 2, 9.00, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (285, 'Uva', 'Red Globe', 4, 2, 6.00, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (286, 'Uva', 'Italia', 4, 2, 5.50, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (287, 'Sandía', 'Corriente', 4, 2, 1.60, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (288, 'Melón', 'Corriente', 4, 2, 3.55, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (289, 'Durazno', 'Corriente', 4, 2, 7.00, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (290, 'Pera', 'De agua', 4, 2, 7.63, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (291, 'Chirimoya', 'Corriente', 4, 2, 6.63, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (292, 'Lúcuma', 'Corriente', 4, 2, 10.50, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (293, 'Granadilla', 'Corriente', 4, 2, 5.25, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (294, 'Tuna', 'Corriente', 4, 2, 8.50, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (295, 'Aguaymanto', 'Fresco', 4, 2, 5.00, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (296, 'Arándano', 'Fresco', 4, 2, 21.00, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (297, 'Cocona', 'Corriente', 4, 2, 3.28, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (298, 'Camu camu', 'Fresco', 4, 2, 6.00, 1); -- ORIGINAL_SIN_VALIDAR; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (299, 'Coco', 'Seco', 4, 2, 8.00, 1); -- ORIGINAL_SIN_VALIDAR; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (300, 'Guanábana', 'Corriente', 4, 2, 7.25, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (301, 'Tumbo', 'Corriente', 4, 2, 6.00, 1); -- ORIGINAL_SIN_VALIDAR; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (302, 'Higo', 'Fresco', 4, 2, 10.00, 1); -- ORIGINAL_SIN_VALIDAR; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (303, 'Mora', 'Fresca', 4, 2, 14.00, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (304, 'Membrillo', 'Corriente', 4, 2, 5.25, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (305, 'Cereza', 'Fresca', 4, 2, 30.00, 1); -- ORIGINAL_SIN_VALIDAR; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (306, 'Kiwi', 'Corriente', 4, 2, 16.00, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (307, 'Ciruela', 'Corriente', 4, 2, 7.00, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (308, 'Guayaba', 'Corriente', 4, 2, 6.00, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (309, 'Pitahaya', 'Corriente', 4, 2, 16.75, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (310, 'Huevo', 'Pardo (por kg)', 6, 2, 7.50, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (311, 'Huevo', 'Blanco (por kg)', 6, 2, 7.20, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (312, 'Huevo', 'Codorniz', 6, 2, 20.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (313, 'Queso', 'Fresco', 6, 2, 24.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (314, 'Queso', 'Parmesano', 6, 2, 57.80, 1); -- REFERENCIA_PUBLICADA; F10
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (315, 'Queso', 'Mozzarella', 6, 2, 32.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (316, 'Queso', 'Edam', 6, 2, 38.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (317, 'Queso', 'Paria', 6, 2, 28.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (318, 'Queso', 'Andino', 6, 2, 30.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (319, 'Queso', 'Crema', 6, 2, 35.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (320, 'Queso', 'Serrano', 6, 2, 28.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (321, 'Queso', 'Ricotta', 6, 2, 26.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (322, 'Queso', 'Manchego', 6, 2, 55.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (323, 'Requesón', 'Fresco', 6, 2, 18.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (324, 'Mantequilla', 'Sin sal', 1, 2, 49.39, 1); -- REFERENCIA_PUBLICADA; F11
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (325, 'Mantequilla', 'Con sal', 1, 2, 49.44, 1); -- REFERENCIA_PUBLICADA; F11
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (326, 'Margarina', 'Culinaria', 1, 2, 12.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (327, 'Crema de leche', 'Fresca', 6, 1, 24.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (328, 'Leche', 'Fresca', 6, 1, 4.50, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (329, 'Leche', 'Evaporada', 6, 1, 10.95, 1); -- ESTIMADO; F19
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (330, 'Leche', 'Condensada', 6, 2, 16.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (331, 'Leche', 'En polvo', 6, 2, 32.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (332, 'Yogurt', 'Natural', 6, 2, 8.50, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (333, 'Aceite', 'Vegetal', 1, 1, 8.57, 1); -- REFERENCIA_PUBLICADA; F08
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (334, 'Aceite', 'Oliva', 1, 1, 40.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (335, 'Aceite', 'Oliva extra virgen', 1, 1, 49.30, 1); -- REFERENCIA_PUBLICADA; F08
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (336, 'Aceite', 'Girasol', 1, 1, 10.50, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (337, 'Aceite', 'Sésamo', 1, 1, 65.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (338, 'Manteca', 'Vegetal', 1, 2, 12.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (339, 'Azúcar', 'Rubia', 1, 2, 3.80, 1); -- REFERENCIA_PUBLICADA; F14
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (340, 'Azúcar', 'Blanca', 1, 2, 4.00, 1); -- REFERENCIA_PUBLICADA; F14
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (341, 'Azúcar', 'Impalpable', 1, 2, 6.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (342, 'Chancaca', 'Pan', 1, 2, 7.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (343, 'Miel', 'De abeja', 1, 2, 30.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (344, 'Sal', 'De mesa', 1, 2, 1.70, 1); -- REFERENCIA_PUBLICADA; F27
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (345, 'Sal', 'Marina', 1, 2, 2.50, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (346, 'Sal', 'De Maras', 1, 2, 10.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (347, 'Sal', 'Gruesa', 1, 2, 2.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (348, 'Pimienta', 'Negra molida', 5, 2, 69.80, 1); -- REFERENCIA_PUBLICADA; F17
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (349, 'Pimienta', 'Negra en grano', 5, 2, 65.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (350, 'Pimienta', 'Blanca', 5, 2, 80.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (351, 'Comino', 'Molido', 5, 2, 39.80, 1); -- REFERENCIA_PUBLICADA; F17
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (352, 'Comino', 'En grano', 5, 2, 35.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (353, 'Orégano', 'Seco', 5, 2, 13.25, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (354, 'Ajo', 'En polvo', 9, 2, 35.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (355, 'Cebolla', 'En polvo', 9, 2, 30.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (356, 'Cúrcuma', 'Molida (palillo)', 5, 2, 25.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (357, 'Pimentón', 'Molido', 9, 2, 28.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (358, 'Páprika', 'Molida', 5, 2, 28.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (359, 'Canela', 'Molida', 5, 2, 50.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (360, 'Canela', 'En rama', 5, 2, 55.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (361, 'Clavo de olor', 'Entero', 5, 2, 85.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (362, 'Anís estrellado', 'Entero', 5, 2, 80.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (363, 'Nuez moscada', 'Entera', 5, 2, 100.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (364, 'Laurel', 'Hoja seca', 5, 2, 40.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (365, 'Achiote', 'Molido', 5, 2, 20.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (366, 'Kión', 'Molido', 5, 2, 40.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (367, 'Ají', 'En polvo', 9, 2, 24.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (368, 'Tomillo', 'Seco', 5, 2, 45.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (369, 'Romero', 'Seco', 5, 2, 45.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (370, 'Ajonjolí', 'Blanco', 5, 2, 10.13, 1); -- REFERENCIA_PUBLICADA; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (371, 'Mostaza', 'En grano', 1, 2, 30.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (372, 'Curry', 'En polvo', 5, 2, 45.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (373, 'Sazonador', 'Sazón completa', 5, 2, 32.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (374, 'Glutamato', 'Monosódico', 1, 2, 15.20, 1); -- REFERENCIA_PUBLICADA; F26
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (375, 'Caldo', 'De gallina en cubos', 1, 2, 28.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (376, 'Caldo', 'De res en cubos', 1, 2, 30.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (377, 'Sillao', 'Salsa de soya', 1, 1, 6.90, 1); -- REFERENCIA_PUBLICADA; F15
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (378, 'Salsa de ostión', 'Botella', 1, 1, 28.80, 1); -- ESTIMADO; F16
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (379, 'Vinagre', 'Blanco', 1, 1, 4.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (380, 'Vinagre', 'Tinto', 1, 1, 5.50, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (381, 'Vinagre', 'Balsámico', 1, 1, 35.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (382, 'Vinagre', 'De manzana', 1, 1, 12.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (383, 'Vinagre', 'De arroz', 1, 1, 18.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (384, 'Harina', 'De trigo sin preparar', 1, 2, 3.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (385, 'Harina', 'Preparada', 1, 2, 4.50, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (386, 'Harina', 'Panadera', 1, 2, 2.10, 1); -- REFERENCIA_PUBLICADA; F25
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (387, 'Harina', 'De maíz', 1, 2, 5.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (388, 'Harina', 'De arroz', 1, 2, 8.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (389, 'Harina', 'De yuca', 1, 2, 7.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (390, 'Fécula', 'De maíz (maicena)', 1, 2, 7.50, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (391, 'Pan', 'Francés', 1, 2, 8.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (392, 'Pan', 'De molde', 1, 2, 12.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (393, 'Pan', 'Rallado', 1, 2, 10.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (394, 'Pan', 'Ciabatta', 1, 2, 14.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (395, 'Pan', 'Hamburguesa', 1, 2, 12.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (396, 'Fideos', 'Tallarín', 1, 2, 5.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (397, 'Fideos', 'Spaghetti', 1, 2, 5.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (398, 'Fideos', 'Canutos', 1, 2, 5.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (399, 'Fideos', 'Tornillo', 1, 2, 5.50, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (400, 'Fideos', 'Lasagna', 1, 2, 12.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (401, 'Fideos', 'Cabello de ángel', 1, 2, 5.50, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (402, 'Masa', 'Para wantán', 1, 2, 10.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (403, 'Masa', 'Para pizza', 1, 2, 10.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (404, 'Levadura', 'Fresca', 1, 2, 15.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (405, 'Levadura', 'Seca', 1, 2, 38.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (406, 'Polvo de hornear', 'Corriente', 1, 2, 20.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (407, 'Bicarbonato', 'De sodio', 1, 2, 10.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (408, 'Gelatina', 'Sin sabor', 1, 2, 60.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (409, 'Galleta', 'De soda', 1, 2, 12.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (410, 'Galleta', 'María', 1, 2, 12.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (411, 'Mayonesa', 'Corriente', 1, 2, 9.57, 1); -- REFERENCIA_PUBLICADA; F09
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (412, 'Ketchup', 'Corriente', 1, 2, 5.30, 1); -- REFERENCIA_PUBLICADA; F26
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (413, 'Mostaza', 'Preparada', 1, 2, 10.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (414, 'Salsa', 'Tártara', 1, 2, 18.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (415, 'Aceituna', 'Botija', 1, 2, 25.00, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (416, 'Aceituna', 'Verde', 1, 2, 18.00, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (417, 'Aceituna', 'Negra', 1, 2, 21.75, 1); -- ESTIMADO; F01
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (418, 'Alcaparras', 'En salmuera', 5, 2, 45.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (419, 'Pepinillos', 'En vinagre', 9, 2, 20.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (420, 'Atún', 'Enlatado en filete', 8, 2, 49.80, 1); -- ESTIMADO; F18
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (421, 'Atún', 'Enlatado en trozos', 8, 2, 49.00, 1); -- ESTIMADO; F07
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (422, 'Sardina', 'Enlatada', 8, 2, 18.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (423, 'Choclo', 'Enlatado', 9, 2, 16.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (424, 'Espárrago', 'Enlatado', 9, 2, 25.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (425, 'Champiñón', 'Enlatado', 9, 2, 20.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (426, 'Pasta de tomate', 'Corriente', 1, 2, 12.42, 1); -- REFERENCIA_PUBLICADA; F26
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (427, 'Tomate', 'Pelado enlatado', 9, 2, 14.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (428, 'Salsa de tomate', 'Corriente', 1, 2, 10.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (429, 'Crema', 'De huancaína', 6, 2, 20.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (430, 'Crema', 'De rocoto', 6, 2, 22.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (431, 'Crema', 'De ají amarillo', 6, 2, 22.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (432, 'Pasta', 'De ají panca', 1, 2, 20.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (433, 'Pasta', 'De ají amarillo', 1, 2, 18.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (434, 'Chimichurri', 'Preparado', 1, 2, 22.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (435, 'Salsa', 'BBQ', 1, 2, 16.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (436, 'Leche de tigre', 'Preparada', 1, 1, 28.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (437, 'Salsa', 'De tamarindo', 1, 2, 18.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (438, 'Wasabi', 'Pasta', 5, 2, 90.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (439, 'Alga nori', 'Hojas', 7, 2, 180.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (440, 'Jengibre', 'Encurtido', 5, 2, 40.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (441, 'Pisco', 'Quebranta', 2, 1, 45.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (442, 'Pisco', 'Acholado', 2, 1, 48.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (443, 'Pisco', 'Italia', 2, 1, 52.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (444, 'Pisco', 'Mosto verde', 2, 1, 65.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (445, 'Ron', 'Blanco', 2, 1, 40.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (446, 'Ron', 'Añejo', 2, 1, 55.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (447, 'Vodka', 'Corriente', 2, 1, 45.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (448, 'Whisky', 'Corriente', 2, 1, 70.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (449, 'Vino', 'Tinto de mesa', 2, 1, 22.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (450, 'Vino', 'Blanco de mesa', 2, 1, 22.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (451, 'Vino', 'Espumante', 2, 1, 40.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (452, 'Cerveza', 'Lager', 2, 1, 10.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (453, 'Cerveza', 'Artesanal', 2, 1, 20.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (454, 'Chicha morada', 'Concentrado', 2, 1, 10.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (455, 'Chicha de jora', 'Fresca', 2, 1, 6.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (456, 'Maracuyá', 'Pulpa congelada', 4, 2, 14.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (457, 'Fresa', 'Pulpa congelada', 4, 2, 15.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (458, 'Limón', 'Jugo embotellado', 4, 1, 16.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (459, 'Gaseosa', 'Cola', 2, 1, 4.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (460, 'Gaseosa', 'Amarilla', 2, 1, 4.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (461, 'Agua', 'Mineral con gas', 2, 1, 3.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (462, 'Agua', 'Sin gas', 2, 1, 2.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (463, 'Agua', 'De coco', 2, 1, 12.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (464, 'Jarabe', 'De goma', 1, 1, 10.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (465, 'Jugo', 'De naranja', 2, 1, 8.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (466, 'Amargo', 'De angostura', 2, 1, 427.50, 1); -- REFERENCIA_PUBLICADA; F23
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (467, 'Triple sec', 'Licor de naranja', 2, 1, 50.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (468, 'Hielo', 'En barra', 1, 2, 2.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (469, 'Ginger ale', 'Corriente', 2, 1, 5.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (470, 'Té', 'Filtrante', 2, 2, 100.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (471, 'Café', 'Molido', 2, 2, 60.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (472, 'Café', 'En grano', 2, 2, 55.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (473, 'Manzanilla', 'Filtrante', 5, 2, 80.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (474, 'Maní', 'Tostado', 1, 2, 14.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (475, 'Maní', 'Pelado', 1, 2, 14.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (476, 'Maní', 'Molido', 1, 2, 18.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (477, 'Nuez', 'Pelada', 1, 2, 48.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (478, 'Almendra', 'Laminada', 1, 2, 55.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (479, 'Pecanas', 'Peladas', 1, 2, 65.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (480, 'Pistacho', 'Pelado', 1, 2, 100.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (481, 'Castaña', 'Pelada', 1, 2, 60.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (482, 'Pasas', 'Negras', 1, 2, 18.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (483, 'Pasas', 'Rubias', 1, 2, 22.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (484, 'Coco', 'Rallado', 4, 2, 25.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (485, 'Chía', 'Semilla', 9, 2, 20.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (486, 'Linaza', 'Semilla', 9, 2, 12.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (487, 'Chifle', 'De plátano', 1, 2, 28.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (488, 'Camote', 'Chips', 9, 2, 32.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (489, 'Esencia', 'De vainilla', 1, 1, 65.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (490, 'Leche', 'De coco', 6, 1, 22.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (491, 'Gelatina', 'Con sabor', 1, 2, 18.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (492, 'Chuño', 'Fécula', 9, 2, 10.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (493, 'Piña', 'Enlatada', 4, 2, 18.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (494, 'Durazno', 'Enlatado', 4, 2, 20.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (495, 'Crema', 'Chantilly', 6, 1, 28.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (496, 'Chocolate', 'Cobertura', 6, 2, 28.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (497, 'Chocolate', 'En barra', 6, 2, 35.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (498, 'Cocoa', 'En polvo', 6, 2, 32.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (499, 'Manjar', 'Blanco', 6, 2, 18.00, 1); -- ESTIMADO; sin fuente
    INSERT INTO dbo.insumos (id_insumo, nombre, variedad, id_categoria, id_unidad, precio_mayorista, activo) VALUES (500, 'Mermelada', 'De fresa', 1, 2, 12.00, 1); -- ESTIMADO; sin fuente
    SET IDENTITY_INSERT dbo.insumos OFF;
END
GO

-- Vista de consulta rápida
CREATE OR ALTER VIEW dbo.vista_insumos AS
SELECT
    i.id_insumo, i.codigo_comercial,
    i.nombre,
    i.variedad,
    c.nombre AS categoria,
    u.codigo AS unidad_medida,
    i.precio_mayorista,
    i.activo
FROM dbo.insumos i
LEFT JOIN dbo.categorias c ON i.id_categoria = c.id_categoria
LEFT JOIN dbo.unidades_medida u ON i.id_unidad = u.id_unidad;
GO

-- ============================================================================
-- 2. PLATOS (estructura existente + columnas nuevas)
-- ============================================================================
IF OBJECT_ID(N'dbo.platos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.platos (
        id_plato BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_platos PRIMARY KEY,
        id_instalacion NVARCHAR(36) NOT NULL,
        id_restaurante INT NOT NULL,
        id_usuario INT NOT NULL,
        id_plato_local INT NOT NULL,
        nombre NVARCHAR(180) NOT NULL,
        descripcion NVARCHAR(500) NULL,
        moneda CHAR(3) NOT NULL,
        porciones DECIMAL(28,6) NOT NULL,
        unidad_produccion NVARCHAR(16) NOT NULL,
        version_receta INT NOT NULL,
        activo BIT NOT NULL,
        generacion BIGINT NOT NULL,
        especificaciones NVARCHAR(MAX) NOT NULL,
        fecha_creacion DATETIME2 NOT NULL CONSTRAINT DF_platos_creacion DEFAULT SYSUTCDATETIME(),
        fecha_actualizacion DATETIME2 NOT NULL CONSTRAINT DF_platos_actualizacion DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_platos_origen UNIQUE(id_instalacion, id_restaurante, id_plato_local),
        CONSTRAINT CK_platos_porciones CHECK(porciones > 0),
        CONSTRAINT CK_platos_version CHECK(version_receta > 0 AND generacion > 0),
        CONSTRAINT CK_platos_especificaciones CHECK(ISJSON(especificaciones) = 1)
    );
    CREATE INDEX IX_platos_restaurante ON dbo.platos(id_instalacion, id_usuario, id_restaurante);
END
GO

-- Columnas nuevas: la web calcula y guarda estos valores después (NULL o 0 por defecto)
IF COL_LENGTH(N'dbo.platos', N'precio_venta') IS NULL
    ALTER TABLE dbo.platos ADD precio_venta DECIMAL(12,2) NULL
        CONSTRAINT DF_platos_precio_venta DEFAULT (0) WITH VALUES;
IF COL_LENGTH(N'dbo.platos', N'margen_ganancia_pct') IS NULL
    ALTER TABLE dbo.platos ADD margen_ganancia_pct DECIMAL(9,4) NULL
        CONSTRAINT DF_platos_margen_pct DEFAULT (0) WITH VALUES;
IF COL_LENGTH(N'dbo.platos', N'margen_ganancia_monto') IS NULL
    ALTER TABLE dbo.platos ADD margen_ganancia_monto DECIMAL(12,2) NULL
        CONSTRAINT DF_platos_margen_monto DEFAULT (0) WITH VALUES;
IF COL_LENGTH(N'dbo.platos', N'categoria_menu') IS NULL
    ALTER TABLE dbo.platos ADD categoria_menu NVARCHAR(50) NULL;
GO

-- ============================================================================
-- 3. RECETA_DETALLES (tabla intermedia plato <-> insumo)
-- ============================================================================
IF OBJECT_ID(N'dbo.receta_detalles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.receta_detalles (
        id_receta_detalle BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_receta_detalles PRIMARY KEY,
        id_plato BIGINT NOT NULL,
        id_insumo INT NOT NULL,
        orden SMALLINT NOT NULL CONSTRAINT DF_receta_detalles_orden DEFAULT (0),
        cantidad DECIMAL(14,4) NOT NULL,
        unidad_receta NVARCHAR(10) NOT NULL,
        factor_a_unidad_base DECIMAL(14,6) NOT NULL,
        merma_pct DECIMAL(5,2) NOT NULL CONSTRAINT DF_receta_detalles_merma DEFAULT (0),
        notas NVARCHAR(200) NULL,
        cantidad_base AS CAST(cantidad * factor_a_unidad_base AS DECIMAL(18,6)) PERSISTED,
        fecha_creacion DATETIME2 NOT NULL CONSTRAINT DF_receta_detalles_creacion DEFAULT SYSUTCDATETIME(),
        fecha_actualizacion DATETIME2 NOT NULL CONSTRAINT DF_receta_detalles_actualizacion DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_receta_detalles_plato FOREIGN KEY (id_plato) REFERENCES dbo.platos(id_plato) ON DELETE CASCADE,
        CONSTRAINT FK_receta_detalles_insumo FOREIGN KEY (id_insumo) REFERENCES dbo.insumos(id_insumo),
        CONSTRAINT UQ_receta_detalles_plato_insumo UNIQUE (id_plato, id_insumo),
        CONSTRAINT CK_receta_detalles_cantidad CHECK (cantidad > 0),
        CONSTRAINT CK_receta_detalles_factor CHECK (factor_a_unidad_base > 0),
        CONSTRAINT CK_receta_detalles_merma CHECK (merma_pct >= 0 AND merma_pct < 100),
        CONSTRAINT CK_receta_detalles_unidad CHECK (unidad_receta IN (N'g', N'kg', N'ml', N'l', N'unid'))
    );
    CREATE INDEX IX_receta_detalles_insumo ON dbo.receta_detalles(id_insumo);
END
GO

-- ============================================================================
-- 4. VISTAS DE COSTEO ESTÁNDAR (con el precio_mayorista vigente)
-- ============================================================================
CREATE OR ALTER VIEW dbo.vista_receta_detalle AS
SELECT
    d.id_receta_detalle,
    d.id_plato,
    p.nombre AS plato,
    d.orden,
    i.id_insumo,
    i.nombre AS insumo,
    i.variedad,
    d.cantidad,
    d.unidad_receta,
    d.merma_pct,
    u.codigo AS unidad_base,
    d.cantidad_base,
    CAST(d.cantidad_base / (1 - d.merma_pct / 100.0) AS DECIMAL(18,6)) AS cantidad_compra_base,
    i.precio_mayorista,
    CAST(d.cantidad_base / (1 - d.merma_pct / 100.0) * i.precio_mayorista AS DECIMAL(18,4)) AS costo_linea
FROM dbo.receta_detalles d
JOIN dbo.platos p ON p.id_plato = d.id_plato
JOIN dbo.insumos i ON i.id_insumo = d.id_insumo
JOIN dbo.unidades_medida u ON u.id_unidad = i.id_unidad;
GO

CREATE OR ALTER VIEW dbo.vista_plato_costo_estandar AS
SELECT
    p.id_plato,
    p.id_plato_local,
    p.nombre,
    p.categoria_menu,
    p.porciones,
    COUNT(v.id_receta_detalle) AS lineas_receta,
    CAST(SUM(v.costo_linea) AS DECIMAL(18,4)) AS costo_receta,
    CAST(SUM(v.costo_linea) / p.porciones AS DECIMAL(18,4)) AS costo_por_porcion,
    p.precio_venta,
    CAST(CASE WHEN ISNULL(p.precio_venta, 0) > 0
              THEN SUM(v.costo_linea) / p.porciones / p.precio_venta * 100 END AS DECIMAL(9,4)) AS food_cost_pct
FROM dbo.platos p
LEFT JOIN dbo.vista_receta_detalle v ON v.id_plato = p.id_plato
GROUP BY p.id_plato, p.id_plato_local, p.nombre, p.categoria_menu, p.porciones, p.precio_venta;
GO

-- ============================================================================
-- 5. CATÁLOGO BASE: 20 PLATOS + RECETAS ESTÁNDAR
--    Los insumos se enlazan por nombre + variedad + tipo de unidad (kg o Litro)
--    y se guardan con su id_insumo. Las 20 recetas usan solo insumos que ya
--    existen en el catálogo, por lo que no hizo falta insertar insumos nuevos;
--    si agregas una línea con un insumo inexistente, el script se detiene y
--    dice cuál falta (agrégalo antes en dbo.insumos).
--
--    Ajusta estos tres valores al restaurante/usuario dueño del catálogo base
--    si tu web filtra los platos por ellos (ver UQ_platos_origen).
-- ============================================================================
DECLARE @id_instalacion NVARCHAR(36) = N'CATALOGO-BASE';
DECLARE @id_restaurante INT          = 0;
DECLARE @id_usuario     INT          = 0;

SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;

    -- 5.1 Platos
    DECLARE @platos TABLE (
        id_plato_local INT NOT NULL PRIMARY KEY,
        nombre NVARCHAR(180) NOT NULL,
        descripcion NVARCHAR(500) NULL,
        porciones DECIMAL(28,6) NOT NULL,
        categoria_menu NVARCHAR(50) NULL
    );
    INSERT INTO @platos (id_plato_local, nombre, descripcion, porciones, categoria_menu) VALUES
        (1, N'Ceviche clásico', N'Filete de corvina fresco marinado al momento en limón sutil, con cebolla roja, ají limo, apio y culantro. Se sirve con camote, choclo, cancha y lechuga.', 1, N'Ceviches y tiraditos'),
        (2, N'Ceviche mixto', N'Corvina, calamar, camarón y pulpo marinados en limón sutil con cebolla roja y ají limo. Acompañado de camote, choclo, cancha y lechuga.', 1, N'Ceviches y tiraditos'),
        (3, N'Ceviche de conchas negras', N'Pulpa de conchas negras al limón con cebolla roja, ají limo y culantro. Se acompaña con camote, choclo, cancha y lechuga.', 1, N'Ceviches y tiraditos'),
        (4, N'Ceviche carretillero', N'Ceviche de corvina coronado con chicharrón de calamar crocante. Servido con camote, choclo, cancha y lechuga.', 1, N'Ceviches y tiraditos'),
        (5, N'Tiradito al ají amarillo', N'Láminas finas de corvina bañadas en salsa cremosa de ají amarillo y limón. Con choclo y camote.', 1, N'Ceviches y tiraditos'),
        (6, N'Leche de tigre', N'Vaso de leche de tigre (250 ml) con limón sutil, fondo de pescado, apio, kión, ají limo y culantro. Servida bien fría con cancha.', 1, N'Ceviches y tiraditos'),
        (7, N'Causa de atún', N'Causa limeña de papa amarilla con ají amarillo y limón, rellena de ensalada de atún y mayonesa. Decorada con palta, huevo y aceituna.', 1, N'Entradas'),
        (8, N'Pulpo al olivo', N'Láminas de pulpo tierno bañadas en salsa cremosa de aceituna botija. Sobre cama de lechuga.', 1, N'Entradas'),
        (9, N'Choros a la chalaca', N'Choros cocidos servidos en su concha con salsa criolla de cebolla, tomate, choclo, ají limo y limón.', 1, N'Entradas'),
        (10, N'Conchas a la parmesana', N'Conchas de abanico gratinadas con queso parmesano, mantequilla y vino blanco. Servidas en su concha.', 1, N'Entradas'),
        (11, N'Chicharrón de pescado', N'Trozos de merluza rebozados y fritos, con yuca frita, salsa criolla y salsa tártara.', 1, N'Frituras'),
        (12, N'Chicharrón de calamar', N'Anillas de calamar rebozadas y fritas, con yuca frita, salsa criolla y salsa tártara.', 1, N'Frituras'),
        (13, N'Chicharrón de pota', N'Trozos de pota rebozados y fritos, con yuca frita, salsa criolla y salsa tártara.', 1, N'Frituras'),
        (14, N'Jalea mixta (para 2)', N'Fritura de pescado, calamar y camarones para dos personas, con yuca frita, salsa criolla y salsa tártara.', 2, N'Frituras'),
        (15, N'Arroz con mariscos', N'Arroz al estilo peruano con ají panca y ají amarillo, camarones, calamar, choros y conchas de abanico.', 1, N'Arroces'),
        (16, N'Arroz chaufa de mariscos', N'Arroz frito al wok con sillao, kión y cebolla china, huevo en tortilla, camarones, calamar y conchas de abanico.', 1, N'Arroces'),
        (17, N'Parihuela', N'Sopa marinera contundente con fumet de pescado, ají panca, corvina, cangrejo, langostino, calamar, choros, conchas y camarones.', 1, N'Sopas'),
        (18, N'Sudado de pescado', N'Filete de corvina cocido al vapor sobre sofrito de tomate, cebolla y ají amarillo. Con arroz blanco y yuca.', 1, N'Platos de fondo'),
        (19, N'Chilcano de pescado', N'Caldo reconfortante de pescado con kión, apio, cebolla china, culantro y limón, con trozos de jurel.', 1, N'Sopas'),
        (20, N'Pescado a lo macho', N'Filete de corvina frito cubierto con salsa cremosa de mariscos al ají panca. Con arroz blanco y papa amarilla.', 1, N'Platos de fondo');

    INSERT INTO dbo.platos
        (id_instalacion, id_restaurante, id_usuario, id_plato_local, nombre, descripcion, moneda,
         porciones, unidad_produccion, version_receta, activo, generacion, especificaciones, categoria_menu)
    SELECT
        @id_instalacion, @id_restaurante, @id_usuario, p.id_plato_local, p.nombre, p.descripcion, 'PEN',
        p.porciones, N'porcion', 1, 1, 1, N'{"schema_version":2,"origen":"catalogo_base"}', p.categoria_menu
    FROM @platos p
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.platos x
        WHERE x.id_instalacion = @id_instalacion
          AND x.id_restaurante = @id_restaurante
          AND x.id_plato_local = p.id_plato_local
    );

    -- 5.2 Líneas de receta estándar (cantidades para la receta completa = porciones del plato)
    DECLARE @receta TABLE (
        id_plato_local INT NOT NULL,
        orden SMALLINT NOT NULL,
        insumo NVARCHAR(100) NOT NULL,
        variedad NVARCHAR(100) NOT NULL,
        cantidad DECIMAL(14,4) NOT NULL,
        unidad_receta NVARCHAR(10) NOT NULL,
        factor_a_unidad_base DECIMAL(14,6) NOT NULL,
        merma_pct DECIMAL(5,2) NOT NULL,
        PRIMARY KEY (id_plato_local, orden)
    );
    INSERT INTO @receta (id_plato_local, orden, insumo, variedad, cantidad, unidad_receta, factor_a_unidad_base, merma_pct) VALUES
        -- 1. Ceviche clásico
        (1, 1, N'Corvina', N'Filete', 180, N'g', 0.001, 5.00),  -- id_insumo 1
        (1, 2, N'Limón', N'Sutil', 10, N'unid', 0.025, 0.00),  -- id_insumo 265
        (1, 3, N'Cebolla', N'Roja', 60, N'g', 0.001, 10.00),  -- id_insumo 184
        (1, 4, N'Ajo', N'Nacional pelado', 3, N'g', 0.001, 5.00),  -- id_insumo 188
        (1, 5, N'Apio', N'Corriente', 10, N'g', 0.001, 10.00),  -- id_insumo 200
        (1, 6, N'Kión', N'Fresco', 3, N'g', 0.001, 15.00),  -- id_insumo 257
        (1, 7, N'Culantro', N'Fresco', 6, N'g', 0.001, 20.00),  -- id_insumo 246
        (1, 8, N'Ají', N'Limo', 5, N'g', 0.001, 15.00),  -- id_insumo 237
        (1, 9, N'Sal', N'De mesa', 3, N'g', 0.001, 0.00),  -- id_insumo 344
        (1, 10, N'Pimienta', N'Negra molida', 0.3, N'g', 0.001, 0.00),  -- id_insumo 348
        (1, 11, N'Camote', N'Amarillo', 100, N'g', 0.001, 20.00),  -- id_insumo 175
        (1, 12, N'Choclo', N'Mazorca', 80, N'g', 0.001, 15.00),  -- id_insumo 212
        (1, 13, N'Maíz', N'Cancha serrana', 25, N'g', 0.001, 0.00),  -- id_insumo 156
        (1, 14, N'Lechuga', N'Americana', 15, N'g', 0.001, 20.00),  -- id_insumo 196
        -- 2. Ceviche mixto
        (2, 1, N'Corvina', N'Filete', 90, N'g', 0.001, 5.00),  -- id_insumo 1
        (2, 2, N'Calamar', N'Anillas', 40, N'g', 0.001, 0.00),  -- id_insumo 52
        (2, 3, N'Camarón', N'Pelado', 40, N'g', 0.001, 0.00),  -- id_insumo 56
        (2, 4, N'Pulpo', N'Tentáculos', 40, N'g', 0.001, 35.00),  -- id_insumo 50
        (2, 5, N'Limón', N'Sutil', 10, N'unid', 0.025, 0.00),  -- id_insumo 265
        (2, 6, N'Cebolla', N'Roja', 60, N'g', 0.001, 10.00),  -- id_insumo 184
        (2, 7, N'Ajo', N'Nacional pelado', 3, N'g', 0.001, 5.00),  -- id_insumo 188
        (2, 8, N'Apio', N'Corriente', 10, N'g', 0.001, 10.00),  -- id_insumo 200
        (2, 9, N'Kión', N'Fresco', 3, N'g', 0.001, 15.00),  -- id_insumo 257
        (2, 10, N'Culantro', N'Fresco', 6, N'g', 0.001, 20.00),  -- id_insumo 246
        (2, 11, N'Ají', N'Limo', 5, N'g', 0.001, 15.00),  -- id_insumo 237
        (2, 12, N'Sal', N'De mesa', 3, N'g', 0.001, 0.00),  -- id_insumo 344
        (2, 13, N'Pimienta', N'Negra molida', 0.3, N'g', 0.001, 0.00),  -- id_insumo 348
        (2, 14, N'Camote', N'Amarillo', 100, N'g', 0.001, 20.00),  -- id_insumo 175
        (2, 15, N'Choclo', N'Mazorca', 80, N'g', 0.001, 15.00),  -- id_insumo 212
        (2, 16, N'Maíz', N'Cancha serrana', 25, N'g', 0.001, 0.00),  -- id_insumo 156
        (2, 17, N'Lechuga', N'Americana', 15, N'g', 0.001, 20.00),  -- id_insumo 196
        -- 3. Ceviche de conchas negras
        (3, 1, N'Conchas negras', N'Pulpa', 100, N'g', 0.001, 0.00),  -- id_insumo 46
        (3, 2, N'Limón', N'Sutil', 8, N'unid', 0.025, 0.00),  -- id_insumo 265
        (3, 3, N'Cebolla', N'Roja', 50, N'g', 0.001, 10.00),  -- id_insumo 184
        (3, 4, N'Ajo', N'Nacional pelado', 3, N'g', 0.001, 5.00),  -- id_insumo 188
        (3, 5, N'Culantro', N'Fresco', 5, N'g', 0.001, 20.00),  -- id_insumo 246
        (3, 6, N'Ají', N'Limo', 4, N'g', 0.001, 15.00),  -- id_insumo 237
        (3, 7, N'Sal', N'De mesa', 2, N'g', 0.001, 0.00),  -- id_insumo 344
        (3, 8, N'Camote', N'Amarillo', 100, N'g', 0.001, 20.00),  -- id_insumo 175
        (3, 9, N'Choclo', N'Mazorca', 80, N'g', 0.001, 15.00),  -- id_insumo 212
        (3, 10, N'Maíz', N'Cancha serrana', 25, N'g', 0.001, 0.00),  -- id_insumo 156
        (3, 11, N'Lechuga', N'Americana', 15, N'g', 0.001, 20.00),  -- id_insumo 196
        -- 4. Ceviche carretillero
        (4, 1, N'Corvina', N'Filete', 120, N'g', 0.001, 5.00),  -- id_insumo 1
        (4, 2, N'Calamar', N'Anillas', 80, N'g', 0.001, 0.00),  -- id_insumo 52
        (4, 3, N'Harina', N'De trigo sin preparar', 25, N'g', 0.001, 0.00),  -- id_insumo 384
        (4, 4, N'Fécula', N'De maíz (maicena)', 10, N'g', 0.001, 0.00),  -- id_insumo 390
        (4, 5, N'Aceite', N'Vegetal', 50, N'ml', 0.001, 0.00),  -- id_insumo 333
        (4, 6, N'Limón', N'Sutil', 9, N'unid', 0.025, 0.00),  -- id_insumo 265
        (4, 7, N'Comino', N'Molido', 0.5, N'g', 0.001, 0.00),  -- id_insumo 351
        (4, 8, N'Cebolla', N'Roja', 60, N'g', 0.001, 10.00),  -- id_insumo 184
        (4, 9, N'Ajo', N'Nacional pelado', 3, N'g', 0.001, 5.00),  -- id_insumo 188
        (4, 10, N'Apio', N'Corriente', 10, N'g', 0.001, 10.00),  -- id_insumo 200
        (4, 11, N'Kión', N'Fresco', 3, N'g', 0.001, 15.00),  -- id_insumo 257
        (4, 12, N'Culantro', N'Fresco', 6, N'g', 0.001, 20.00),  -- id_insumo 246
        (4, 13, N'Ají', N'Limo', 5, N'g', 0.001, 15.00),  -- id_insumo 237
        (4, 14, N'Sal', N'De mesa', 4, N'g', 0.001, 0.00),  -- id_insumo 344
        (4, 15, N'Pimienta', N'Negra molida', 0.3, N'g', 0.001, 0.00),  -- id_insumo 348
        (4, 16, N'Camote', N'Amarillo', 100, N'g', 0.001, 20.00),  -- id_insumo 175
        (4, 17, N'Choclo', N'Mazorca', 80, N'g', 0.001, 15.00),  -- id_insumo 212
        (4, 18, N'Maíz', N'Cancha serrana', 25, N'g', 0.001, 0.00),  -- id_insumo 156
        (4, 19, N'Lechuga', N'Americana', 15, N'g', 0.001, 20.00),  -- id_insumo 196
        -- 5. Tiradito al ají amarillo
        (5, 1, N'Corvina', N'Filete', 160, N'g', 0.001, 5.00),  -- id_insumo 1
        (5, 2, N'Pasta', N'De ají amarillo', 25, N'g', 0.001, 0.00),  -- id_insumo 433
        (5, 3, N'Limón', N'Sutil', 6, N'unid', 0.025, 0.00),  -- id_insumo 265
        (5, 4, N'Apio', N'Corriente', 8, N'g', 0.001, 10.00),  -- id_insumo 200
        (5, 5, N'Ajo', N'Nacional pelado', 3, N'g', 0.001, 5.00),  -- id_insumo 188
        (5, 6, N'Kión', N'Fresco', 3, N'g', 0.001, 15.00),  -- id_insumo 257
        (5, 7, N'Culantro', N'Fresco', 3, N'g', 0.001, 20.00),  -- id_insumo 246
        (5, 8, N'Ají', N'Limo', 3, N'g', 0.001, 15.00),  -- id_insumo 237
        (5, 9, N'Sal', N'De mesa', 3, N'g', 0.001, 0.00),  -- id_insumo 344
        (5, 10, N'Choclo', N'Mazorca', 50, N'g', 0.001, 15.00),  -- id_insumo 212
        (5, 11, N'Camote', N'Amarillo', 60, N'g', 0.001, 20.00),  -- id_insumo 175
        -- 6. Leche de tigre
        (6, 1, N'Limón', N'Sutil', 14, N'unid', 0.025, 0.00),  -- id_insumo 265
        (6, 2, N'Corvina', N'Filete', 40, N'g', 0.001, 5.00),  -- id_insumo 1
        (6, 3, N'Espinas de pescado', N'Para fumet', 60, N'g', 0.001, 0.00),  -- id_insumo 44
        (6, 4, N'Cebolla', N'Roja', 30, N'g', 0.001, 10.00),  -- id_insumo 184
        (6, 5, N'Apio', N'Corriente', 20, N'g', 0.001, 10.00),  -- id_insumo 200
        (6, 6, N'Kión', N'Fresco', 5, N'g', 0.001, 15.00),  -- id_insumo 257
        (6, 7, N'Ajo', N'Nacional pelado', 4, N'g', 0.001, 5.00),  -- id_insumo 188
        (6, 8, N'Ají', N'Limo', 6, N'g', 0.001, 15.00),  -- id_insumo 237
        (6, 9, N'Culantro', N'Fresco', 8, N'g', 0.001, 20.00),  -- id_insumo 246
        (6, 10, N'Sal', N'De mesa', 3, N'g', 0.001, 0.00),  -- id_insumo 344
        (6, 11, N'Hielo', N'En barra', 40, N'g', 0.001, 0.00),  -- id_insumo 468
        (6, 12, N'Maíz', N'Cancha serrana', 15, N'g', 0.001, 0.00),  -- id_insumo 156
        -- 7. Causa de atún
        (7, 1, N'Papa', N'Amarilla', 200, N'g', 0.001, 15.00),  -- id_insumo 165
        (7, 2, N'Pasta', N'De ají amarillo', 20, N'g', 0.001, 0.00),  -- id_insumo 433
        (7, 3, N'Limón', N'Sutil', 3, N'unid', 0.025, 0.00),  -- id_insumo 265
        (7, 4, N'Aceite', N'Vegetal', 15, N'ml', 0.001, 0.00),  -- id_insumo 333
        (7, 5, N'Sal', N'De mesa', 2, N'g', 0.001, 0.00),  -- id_insumo 344
        (7, 6, N'Pimienta', N'Negra molida', 0.2, N'g', 0.001, 0.00),  -- id_insumo 348
        (7, 7, N'Atún', N'Enlatado en filete', 90, N'g', 0.001, 0.00),  -- id_insumo 420
        (7, 8, N'Mayonesa', N'Corriente', 40, N'g', 0.001, 0.00),  -- id_insumo 411
        (7, 9, N'Cebolla', N'Roja', 15, N'g', 0.001, 10.00),  -- id_insumo 184
        (7, 10, N'Palta', N'Hass', 60, N'g', 0.001, 30.00),  -- id_insumo 267
        (7, 11, N'Huevo', N'Pardo (por kg)', 0.5, N'unid', 0.06, 0.00),  -- id_insumo 310
        (7, 12, N'Aceituna', N'Negra', 10, N'g', 0.001, 10.00),  -- id_insumo 417
        (7, 13, N'Lechuga', N'Americana', 15, N'g', 0.001, 20.00),  -- id_insumo 196
        -- 8. Pulpo al olivo
        (8, 1, N'Pulpo', N'Tentáculos', 120, N'g', 0.001, 35.00),  -- id_insumo 50
        (8, 2, N'Aceituna', N'Botija', 45, N'g', 0.001, 12.00),  -- id_insumo 415
        (8, 3, N'Mayonesa', N'Corriente', 25, N'g', 0.001, 0.00),  -- id_insumo 411
        (8, 4, N'Queso', N'Fresco', 20, N'g', 0.001, 0.00),  -- id_insumo 313
        (8, 5, N'Leche', N'Evaporada', 25, N'ml', 0.001, 0.00),  -- id_insumo 329
        (8, 6, N'Ajo', N'Nacional pelado', 3, N'g', 0.001, 5.00),  -- id_insumo 188
        (8, 7, N'Aceite', N'Oliva', 10, N'ml', 0.001, 0.00),  -- id_insumo 334
        (8, 8, N'Limón', N'Sutil', 1, N'unid', 0.025, 0.00),  -- id_insumo 265
        (8, 9, N'Sal', N'De mesa', 1.5, N'g', 0.001, 0.00),  -- id_insumo 344
        (8, 10, N'Pimienta', N'Negra molida', 0.3, N'g', 0.001, 0.00),  -- id_insumo 348
        (8, 11, N'Lechuga', N'Americana', 20, N'g', 0.001, 20.00),  -- id_insumo 196
        -- 9. Choros a la chalaca
        (9, 1, N'Choros', N'Con valva', 250, N'g', 0.001, 0.00),  -- id_insumo 63
        (9, 2, N'Cebolla', N'Roja', 50, N'g', 0.001, 10.00),  -- id_insumo 184
        (9, 3, N'Tomate', N'Italiano', 60, N'g', 0.001, 5.00),  -- id_insumo 191
        (9, 4, N'Maíz', N'Choclo desgranado', 40, N'g', 0.001, 0.00),  -- id_insumo 154
        (9, 5, N'Ají', N'Limo', 3, N'g', 0.001, 15.00),  -- id_insumo 237
        (9, 6, N'Culantro', N'Fresco', 5, N'g', 0.001, 20.00),  -- id_insumo 246
        (9, 7, N'Limón', N'Sutil', 4, N'unid', 0.025, 0.00),  -- id_insumo 265
        (9, 8, N'Sal', N'De mesa', 1.5, N'g', 0.001, 0.00),  -- id_insumo 344
        (9, 9, N'Aceite', N'Vegetal', 5, N'ml', 0.001, 0.00),  -- id_insumo 333
        (9, 10, N'Pimienta', N'Negra molida', 0.2, N'g', 0.001, 0.00),  -- id_insumo 348
        -- 10. Conchas a la parmesana
        (10, 1, N'Conchas de abanico', N'Con coral', 180, N'g', 0.001, 0.00),  -- id_insumo 47
        (10, 2, N'Queso', N'Parmesano', 35, N'g', 0.001, 0.00),  -- id_insumo 314
        (10, 3, N'Mantequilla', N'Sin sal', 15, N'g', 0.001, 0.00),  -- id_insumo 324
        (10, 4, N'Vino', N'Blanco de mesa', 40, N'ml', 0.001, 0.00),  -- id_insumo 450
        (10, 5, N'Limón', N'Sutil', 1, N'unid', 0.025, 0.00),  -- id_insumo 265
        (10, 6, N'Ajo', N'Nacional pelado', 3, N'g', 0.001, 5.00),  -- id_insumo 188
        (10, 7, N'Sal', N'De mesa', 1.5, N'g', 0.001, 0.00),  -- id_insumo 344
        (10, 8, N'Pimienta', N'Negra molida', 0.3, N'g', 0.001, 0.00),  -- id_insumo 348
        (10, 9, N'Pan', N'Rallado', 8, N'g', 0.001, 0.00),  -- id_insumo 393
        -- 11. Chicharrón de pescado
        (11, 1, N'Merluza', N'Filete', 200, N'g', 0.001, 5.00),  -- id_insumo 18
        (11, 2, N'Harina', N'De trigo sin preparar', 35, N'g', 0.001, 0.00),  -- id_insumo 384
        (11, 3, N'Fécula', N'De maíz (maicena)', 15, N'g', 0.001, 0.00),  -- id_insumo 390
        (11, 4, N'Ajo', N'Molido', 4, N'g', 0.001, 0.00),  -- id_insumo 190
        (11, 5, N'Comino', N'Molido', 0.8, N'g', 0.001, 0.00),  -- id_insumo 351
        (11, 6, N'Sal', N'De mesa', 3, N'g', 0.001, 0.00),  -- id_insumo 344
        (11, 7, N'Pimienta', N'Negra molida', 0.4, N'g', 0.001, 0.00),  -- id_insumo 348
        (11, 8, N'Limón', N'Sutil', 3, N'unid', 0.025, 0.00),  -- id_insumo 265
        (11, 9, N'Aceite', N'Vegetal', 90, N'ml', 0.001, 0.00),  -- id_insumo 333
        (11, 10, N'Yuca', N'Blanca', 120, N'g', 0.001, 20.00),  -- id_insumo 178
        (11, 11, N'Cebolla', N'Roja', 40, N'g', 0.001, 10.00),  -- id_insumo 184
        (11, 12, N'Ají', N'Limo', 3, N'g', 0.001, 15.00),  -- id_insumo 237
        (11, 13, N'Culantro', N'Fresco', 4, N'g', 0.001, 20.00),  -- id_insumo 246
        (11, 14, N'Salsa', N'Tártara', 30, N'g', 0.001, 0.00),  -- id_insumo 414
        -- 12. Chicharrón de calamar
        (12, 1, N'Calamar', N'Anillas', 200, N'g', 0.001, 0.00),  -- id_insumo 52
        (12, 2, N'Harina', N'De trigo sin preparar', 35, N'g', 0.001, 0.00),  -- id_insumo 384
        (12, 3, N'Fécula', N'De maíz (maicena)', 15, N'g', 0.001, 0.00),  -- id_insumo 390
        (12, 4, N'Ajo', N'Molido', 4, N'g', 0.001, 0.00),  -- id_insumo 190
        (12, 5, N'Comino', N'Molido', 0.8, N'g', 0.001, 0.00),  -- id_insumo 351
        (12, 6, N'Sal', N'De mesa', 3, N'g', 0.001, 0.00),  -- id_insumo 344
        (12, 7, N'Pimienta', N'Negra molida', 0.4, N'g', 0.001, 0.00),  -- id_insumo 348
        (12, 8, N'Limón', N'Sutil', 3, N'unid', 0.025, 0.00),  -- id_insumo 265
        (12, 9, N'Aceite', N'Vegetal', 90, N'ml', 0.001, 0.00),  -- id_insumo 333
        (12, 10, N'Yuca', N'Blanca', 120, N'g', 0.001, 20.00),  -- id_insumo 178
        (12, 11, N'Cebolla', N'Roja', 40, N'g', 0.001, 10.00),  -- id_insumo 184
        (12, 12, N'Ají', N'Limo', 3, N'g', 0.001, 15.00),  -- id_insumo 237
        (12, 13, N'Culantro', N'Fresco', 4, N'g', 0.001, 20.00),  -- id_insumo 246
        (12, 14, N'Salsa', N'Tártara', 30, N'g', 0.001, 0.00),  -- id_insumo 414
        -- 13. Chicharrón de pota
        (13, 1, N'Pota', N'Filete', 220, N'g', 0.001, 5.00),  -- id_insumo 21
        (13, 2, N'Harina', N'De trigo sin preparar', 35, N'g', 0.001, 0.00),  -- id_insumo 384
        (13, 3, N'Fécula', N'De maíz (maicena)', 15, N'g', 0.001, 0.00),  -- id_insumo 390
        (13, 4, N'Ajo', N'Molido', 4, N'g', 0.001, 0.00),  -- id_insumo 190
        (13, 5, N'Comino', N'Molido', 0.8, N'g', 0.001, 0.00),  -- id_insumo 351
        (13, 6, N'Sal', N'De mesa', 3, N'g', 0.001, 0.00),  -- id_insumo 344
        (13, 7, N'Pimienta', N'Negra molida', 0.4, N'g', 0.001, 0.00),  -- id_insumo 348
        (13, 8, N'Limón', N'Sutil', 3, N'unid', 0.025, 0.00),  -- id_insumo 265
        (13, 9, N'Aceite', N'Vegetal', 90, N'ml', 0.001, 0.00),  -- id_insumo 333
        (13, 10, N'Yuca', N'Blanca', 120, N'g', 0.001, 20.00),  -- id_insumo 178
        (13, 11, N'Cebolla', N'Roja', 40, N'g', 0.001, 10.00),  -- id_insumo 184
        (13, 12, N'Ají', N'Limo', 3, N'g', 0.001, 15.00),  -- id_insumo 237
        (13, 13, N'Culantro', N'Fresco', 4, N'g', 0.001, 20.00),  -- id_insumo 246
        (13, 14, N'Salsa', N'Tártara', 30, N'g', 0.001, 0.00),  -- id_insumo 414
        -- 14. Jalea mixta (para 2)
        (14, 1, N'Merluza', N'Filete', 240, N'g', 0.001, 5.00),  -- id_insumo 18
        (14, 2, N'Calamar', N'Anillas', 120, N'g', 0.001, 0.00),  -- id_insumo 52
        (14, 3, N'Camarón', N'Pelado', 100, N'g', 0.001, 0.00),  -- id_insumo 56
        (14, 4, N'Harina', N'De trigo sin preparar', 90, N'g', 0.001, 0.00),  -- id_insumo 384
        (14, 5, N'Fécula', N'De maíz (maicena)', 30, N'g', 0.001, 0.00),  -- id_insumo 390
        (14, 6, N'Ajo', N'Molido', 8, N'g', 0.001, 0.00),  -- id_insumo 190
        (14, 7, N'Comino', N'Molido', 1.5, N'g', 0.001, 0.00),  -- id_insumo 351
        (14, 8, N'Sal', N'De mesa', 6, N'g', 0.001, 0.00),  -- id_insumo 344
        (14, 9, N'Pimienta', N'Negra molida', 0.8, N'g', 0.001, 0.00),  -- id_insumo 348
        (14, 10, N'Limón', N'Sutil', 6, N'unid', 0.025, 0.00),  -- id_insumo 265
        (14, 11, N'Aceite', N'Vegetal', 200, N'ml', 0.001, 0.00),  -- id_insumo 333
        (14, 12, N'Yuca', N'Blanca', 300, N'g', 0.001, 20.00),  -- id_insumo 178
        (14, 13, N'Cebolla', N'Roja', 100, N'g', 0.001, 10.00),  -- id_insumo 184
        (14, 14, N'Ají', N'Limo', 6, N'g', 0.001, 15.00),  -- id_insumo 237
        (14, 15, N'Culantro', N'Fresco', 8, N'g', 0.001, 20.00),  -- id_insumo 246
        (14, 16, N'Salsa', N'Tártara', 60, N'g', 0.001, 0.00),  -- id_insumo 414
        -- 15. Arroz con mariscos
        (15, 1, N'Arroz', N'Superior (Costa)', 100, N'g', 0.001, 0.00),  -- id_insumo 134
        (15, 2, N'Camarón', N'Pelado', 40, N'g', 0.001, 0.00),  -- id_insumo 56
        (15, 3, N'Calamar', N'Anillas', 50, N'g', 0.001, 0.00),  -- id_insumo 52
        (15, 4, N'Choros', N'Pulpa', 40, N'g', 0.001, 0.00),  -- id_insumo 64
        (15, 5, N'Conchas de abanico', N'Sin coral', 30, N'g', 0.001, 0.00),  -- id_insumo 48
        (15, 6, N'Espinas de pescado', N'Para fumet', 120, N'g', 0.001, 0.00),  -- id_insumo 44
        (15, 7, N'Pasta', N'De ají amarillo', 20, N'g', 0.001, 0.00),  -- id_insumo 433
        (15, 8, N'Ají', N'Panca molido', 8, N'g', 0.001, 0.00),  -- id_insumo 240
        (15, 9, N'Cebolla', N'Roja', 70, N'g', 0.001, 10.00),  -- id_insumo 184
        (15, 10, N'Ajo', N'Nacional pelado', 6, N'g', 0.001, 5.00),  -- id_insumo 188
        (15, 11, N'Pimiento', N'Rojo', 25, N'g', 0.001, 15.00),  -- id_insumo 201
        (15, 12, N'Arveja', N'Pelada', 20, N'g', 0.001, 0.00),  -- id_insumo 214
        (15, 13, N'Aceite', N'Vegetal', 20, N'ml', 0.001, 0.00),  -- id_insumo 333
        (15, 14, N'Vino', N'Blanco de mesa', 30, N'ml', 0.001, 0.00),  -- id_insumo 450
        (15, 15, N'Culantro', N'Fresco', 15, N'g', 0.001, 20.00),  -- id_insumo 246
        (15, 16, N'Limón', N'Sutil', 1, N'unid', 0.025, 0.00),  -- id_insumo 265
        (15, 17, N'Sal', N'De mesa', 3, N'g', 0.001, 0.00),  -- id_insumo 344
        (15, 18, N'Pimienta', N'Negra molida', 0.4, N'g', 0.001, 0.00),  -- id_insumo 348
        (15, 19, N'Comino', N'Molido', 1, N'g', 0.001, 0.00),  -- id_insumo 351
        -- 16. Arroz chaufa de mariscos
        (16, 1, N'Arroz', N'Superior (Costa)', 100, N'g', 0.001, 0.00),  -- id_insumo 134
        (16, 2, N'Huevo', N'Pardo (por kg)', 1, N'unid', 0.06, 0.00),  -- id_insumo 310
        (16, 3, N'Cebolla china', N'Verde', 35, N'g', 0.001, 10.00),  -- id_insumo 186
        (16, 4, N'Kión', N'Fresco', 5, N'g', 0.001, 15.00),  -- id_insumo 257
        (16, 5, N'Ajo', N'Nacional pelado', 4, N'g', 0.001, 5.00),  -- id_insumo 188
        (16, 6, N'Sillao', N'Salsa de soya', 20, N'ml', 0.001, 0.00),  -- id_insumo 377
        (16, 7, N'Salsa de ostión', N'Botella', 8, N'ml', 0.001, 0.00),  -- id_insumo 378
        (16, 8, N'Aceite', N'Vegetal', 25, N'ml', 0.001, 0.00),  -- id_insumo 333
        (16, 9, N'Camarón', N'Pelado', 40, N'g', 0.001, 0.00),  -- id_insumo 56
        (16, 10, N'Calamar', N'Anillas', 40, N'g', 0.001, 0.00),  -- id_insumo 52
        (16, 11, N'Conchas de abanico', N'Sin coral', 25, N'g', 0.001, 0.00),  -- id_insumo 48
        (16, 12, N'Pimiento', N'Rojo', 20, N'g', 0.001, 15.00),  -- id_insumo 201
        (16, 13, N'Brotes de soya', N'Frescos', 20, N'g', 0.001, 0.00),  -- id_insumo 229
        (16, 14, N'Sal', N'De mesa', 2, N'g', 0.001, 0.00),  -- id_insumo 344
        (16, 15, N'Pimienta', N'Negra molida', 0.3, N'g', 0.001, 0.00),  -- id_insumo 348
        -- 17. Parihuela
        (17, 1, N'Corvina', N'Filete', 90, N'g', 0.001, 5.00),  -- id_insumo 1
        (17, 2, N'Cangrejo', N'Violáceo', 120, N'g', 0.001, 0.00),  -- id_insumo 60
        (17, 3, N'Langostino', N'Cola pelada', 40, N'g', 0.001, 0.00),  -- id_insumo 58
        (17, 4, N'Calamar', N'Anillas', 50, N'g', 0.001, 0.00),  -- id_insumo 52
        (17, 5, N'Choros', N'Con valva', 100, N'g', 0.001, 0.00),  -- id_insumo 63
        (17, 6, N'Conchas de abanico', N'Sin coral', 30, N'g', 0.001, 0.00),  -- id_insumo 48
        (17, 7, N'Camarón', N'Pelado', 30, N'g', 0.001, 0.00),  -- id_insumo 56
        (17, 8, N'Cabeza de pescado', N'Para fumet', 200, N'g', 0.001, 0.00),  -- id_insumo 43
        (17, 9, N'Espinas de pescado', N'Para fumet', 150, N'g', 0.001, 0.00),  -- id_insumo 44
        (17, 10, N'Pasta', N'De ají panca', 20, N'g', 0.001, 0.00),  -- id_insumo 432
        (17, 11, N'Pasta', N'De ají amarillo', 15, N'g', 0.001, 0.00),  -- id_insumo 433
        (17, 12, N'Cebolla', N'Roja', 60, N'g', 0.001, 10.00),  -- id_insumo 184
        (17, 13, N'Ajo', N'Nacional pelado', 8, N'g', 0.001, 5.00),  -- id_insumo 188
        (17, 14, N'Tomate', N'Italiano', 60, N'g', 0.001, 5.00),  -- id_insumo 191
        (17, 15, N'Apio', N'Corriente', 15, N'g', 0.001, 10.00),  -- id_insumo 200
        (17, 16, N'Culantro', N'Fresco', 10, N'g', 0.001, 20.00),  -- id_insumo 246
        (17, 17, N'Pimiento', N'Rojo', 20, N'g', 0.001, 15.00),  -- id_insumo 201
        (17, 18, N'Vino', N'Blanco de mesa', 40, N'ml', 0.001, 0.00),  -- id_insumo 450
        (17, 19, N'Aceite', N'Vegetal', 20, N'ml', 0.001, 0.00),  -- id_insumo 333
        (17, 20, N'Limón', N'Sutil', 1, N'unid', 0.025, 0.00),  -- id_insumo 265
        (17, 21, N'Ají', N'Limo', 4, N'g', 0.001, 15.00),  -- id_insumo 237
        (17, 22, N'Sal', N'De mesa', 4, N'g', 0.001, 0.00),  -- id_insumo 344
        (17, 23, N'Comino', N'Molido', 1, N'g', 0.001, 0.00),  -- id_insumo 351
        (17, 24, N'Orégano', N'Seco', 0.5, N'g', 0.001, 0.00),  -- id_insumo 353
        (17, 25, N'Pimienta', N'Negra molida', 0.4, N'g', 0.001, 0.00),  -- id_insumo 348
        -- 18. Sudado de pescado
        (18, 1, N'Corvina', N'Filete', 200, N'g', 0.001, 5.00),  -- id_insumo 1
        (18, 2, N'Tomate', N'Italiano', 100, N'g', 0.001, 5.00),  -- id_insumo 191
        (18, 3, N'Cebolla', N'Roja', 80, N'g', 0.001, 10.00),  -- id_insumo 184
        (18, 4, N'Pasta', N'De ají amarillo', 15, N'g', 0.001, 0.00),  -- id_insumo 433
        (18, 5, N'Ají', N'Limo', 3, N'g', 0.001, 15.00),  -- id_insumo 237
        (18, 6, N'Ajo', N'Nacional pelado', 5, N'g', 0.001, 5.00),  -- id_insumo 188
        (18, 7, N'Culantro', N'Fresco', 8, N'g', 0.001, 20.00),  -- id_insumo 246
        (18, 8, N'Chicha de jora', N'Fresca', 40, N'ml', 0.001, 0.00),  -- id_insumo 455
        (18, 9, N'Aceite', N'Vegetal', 25, N'ml', 0.001, 0.00),  -- id_insumo 333
        (18, 10, N'Sal', N'De mesa', 3, N'g', 0.001, 0.00),  -- id_insumo 344
        (18, 11, N'Pimienta', N'Negra molida', 0.5, N'g', 0.001, 0.00),  -- id_insumo 348
        (18, 12, N'Comino', N'Molido', 0.6, N'g', 0.001, 0.00),  -- id_insumo 351
        (18, 13, N'Limón', N'Sutil', 1, N'unid', 0.025, 0.00),  -- id_insumo 265
        (18, 14, N'Arroz', N'Superior (Costa)', 90, N'g', 0.001, 0.00),  -- id_insumo 134
        (18, 15, N'Yuca', N'Blanca', 120, N'g', 0.001, 20.00),  -- id_insumo 178
        -- 19. Chilcano de pescado
        (19, 1, N'Cabeza de pescado', N'Para fumet', 250, N'g', 0.001, 0.00),  -- id_insumo 43
        (19, 2, N'Espinas de pescado', N'Para fumet', 150, N'g', 0.001, 0.00),  -- id_insumo 44
        (19, 3, N'Jurel', N'Filete', 100, N'g', 0.001, 5.00),  -- id_insumo 10
        (19, 4, N'Cebolla china', N'Verde', 30, N'g', 0.001, 10.00),  -- id_insumo 186
        (19, 5, N'Kión', N'Fresco', 10, N'g', 0.001, 15.00),  -- id_insumo 257
        (19, 6, N'Ajo', N'Nacional pelado', 4, N'g', 0.001, 5.00),  -- id_insumo 188
        (19, 7, N'Apio', N'Corriente', 30, N'g', 0.001, 10.00),  -- id_insumo 200
        (19, 8, N'Culantro', N'Fresco', 10, N'g', 0.001, 20.00),  -- id_insumo 246
        (19, 9, N'Ají', N'Limo', 5, N'g', 0.001, 15.00),  -- id_insumo 237
        (19, 10, N'Limón', N'Sutil', 2, N'unid', 0.025, 0.00),  -- id_insumo 265
        (19, 11, N'Sal', N'De mesa', 4, N'g', 0.001, 0.00),  -- id_insumo 344
        (19, 12, N'Pimienta', N'Negra molida', 0.3, N'g', 0.001, 0.00),  -- id_insumo 348
        -- 20. Pescado a lo macho
        (20, 1, N'Corvina', N'Filete', 200, N'g', 0.001, 5.00),  -- id_insumo 1
        (20, 2, N'Harina', N'De trigo sin preparar', 30, N'g', 0.001, 0.00),  -- id_insumo 384
        (20, 3, N'Fécula', N'De maíz (maicena)', 18, N'g', 0.001, 0.00),  -- id_insumo 390
        (20, 4, N'Aceite', N'Vegetal', 100, N'ml', 0.001, 0.00),  -- id_insumo 333
        (20, 5, N'Camarón', N'Pelado', 30, N'g', 0.001, 0.00),  -- id_insumo 56
        (20, 6, N'Calamar', N'Anillas', 30, N'g', 0.001, 0.00),  -- id_insumo 52
        (20, 7, N'Choros', N'Pulpa', 30, N'g', 0.001, 0.00),  -- id_insumo 64
        (20, 8, N'Cebolla', N'Roja', 50, N'g', 0.001, 10.00),  -- id_insumo 184
        (20, 9, N'Ajo', N'Nacional pelado', 6, N'g', 0.001, 5.00),  -- id_insumo 188
        (20, 10, N'Pasta', N'De ají panca', 15, N'g', 0.001, 0.00),  -- id_insumo 432
        (20, 11, N'Pasta', N'De ají amarillo', 15, N'g', 0.001, 0.00),  -- id_insumo 433
        (20, 12, N'Vino', N'Blanco de mesa', 30, N'ml', 0.001, 0.00),  -- id_insumo 450
        (20, 13, N'Leche', N'Evaporada', 40, N'ml', 0.001, 0.00),  -- id_insumo 329
        (20, 14, N'Culantro', N'Fresco', 6, N'g', 0.001, 20.00),  -- id_insumo 246
        (20, 15, N'Arroz', N'Superior (Costa)', 90, N'g', 0.001, 0.00),  -- id_insumo 134
        (20, 16, N'Papa', N'Amarilla', 120, N'g', 0.001, 15.00),  -- id_insumo 165
        (20, 17, N'Sal', N'De mesa', 4, N'g', 0.001, 0.00),  -- id_insumo 344
        (20, 18, N'Pimienta', N'Negra molida', 0.5, N'g', 0.001, 0.00),  -- id_insumo 348
        (20, 19, N'Comino', N'Molido', 0.8, N'g', 0.001, 0.00),  -- id_insumo 351
        (20, 20, N'Limón', N'Sutil', 1, N'unid', 0.025, 0.00);  -- id_insumo 265

    -- 5.3 Verificación: cada línea debe resolver a un insumo del catálogo con unidad compatible
    --     (g, kg, unid -> insumo en kg ; ml, l -> insumo en Litro)
    DECLARE @faltante NVARCHAR(300);
    SELECT TOP (1) @faltante = r.insumo + N' / ' + r.variedad + N' (' + r.unidad_receta + N')'
    FROM @receta r
    WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.insumos i
        JOIN dbo.unidades_medida um ON um.id_unidad = i.id_unidad
        WHERE i.nombre COLLATE Latin1_General_CI_AI = r.insumo COLLATE Latin1_General_CI_AI
          AND i.variedad COLLATE Latin1_General_CI_AI = r.variedad COLLATE Latin1_General_CI_AI
          AND um.codigo = CASE WHEN r.unidad_receta IN (N'ml', N'l') THEN N'Litro' ELSE N'kg' END
    );
    IF @faltante IS NOT NULL
    BEGIN
        DECLARE @msg NVARCHAR(400) = CONCAT(N'Insumo no encontrado en dbo.insumos o con unidad incompatible: ', @faltante);
        THROW 50001, @msg, 1;
    END;

    -- 5.4 Inserción en receta_detalles (solo para platos que aún no tienen receta)
    INSERT INTO dbo.receta_detalles (id_plato, id_insumo, orden, cantidad, unidad_receta, factor_a_unidad_base, merma_pct)
    SELECT pl.id_plato, i.id_insumo, r.orden, r.cantidad, r.unidad_receta, r.factor_a_unidad_base, r.merma_pct
    FROM @receta r
    JOIN dbo.platos pl
        ON pl.id_instalacion = @id_instalacion
       AND pl.id_restaurante = @id_restaurante
       AND pl.id_plato_local = r.id_plato_local
    JOIN dbo.insumos i
        ON i.nombre COLLATE Latin1_General_CI_AI = r.insumo COLLATE Latin1_General_CI_AI
       AND i.variedad COLLATE Latin1_General_CI_AI = r.variedad COLLATE Latin1_General_CI_AI
    JOIN dbo.unidades_medida um
        ON um.id_unidad = i.id_unidad
       AND um.codigo = CASE WHEN r.unidad_receta IN (N'ml', N'l') THEN N'Litro' ELSE N'kg' END
    WHERE NOT EXISTS (SELECT 1 FROM dbo.receta_detalles d WHERE d.id_plato = pl.id_plato);

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

-- ============================================================================
-- 6. APLICACIÓN DE PRECIOS REFERENCIALES A INSUMOS NUEVOS O YA EXISTENTES
-- Se resuelve por nombre + variedad + unidad; NO por id_insumo numérico.
-- La tabla variable existe solo durante la ejecución, no cambia el esquema.
-- Se comprueba que todo el catálogo coincida antes de actualizar. Si existen
-- diferencias de nombre/variedad/unidad, se revierte el bloque completo.
-- ============================================================================
SET XACT_ABORT ON;
DECLARE @precios_revision TABLE (
    nombre NVARCHAR(100) NOT NULL,
    variedad NVARCHAR(100) NOT NULL,
    unidad_base NVARCHAR(20) NOT NULL,
    precio DECIMAL(10,2) NOT NULL CHECK (precio > 0),
    criterio NVARCHAR(30) NOT NULL,
    referencia NVARCHAR(120) NOT NULL,
    PRIMARY KEY (nombre, variedad, unidad_base)
);

INSERT INTO @precios_revision
    (nombre, variedad, unidad_base, precio, criterio, referencia)
VALUES
    (N'Corvina', N'Filete', N'kg', 75.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación de S/75/kg de filete crudo: referencias de corvina entera y minorista; NO cotización mayorista verificada.
    (N'Corvina', N'Entera', N'kg', 40.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación; referencia histórica de corvina entera en septiembre, NO precio diario de octubre confirmado.
    (N'Lenguado', N'Filete', N'kg', 90.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Lenguado', N'Entero', N'kg', 55.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Pejerrey', N'Entero', N'kg', 14.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Pejerrey', N'Filete', N'kg', 26.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Bonito', N'Entero', N'kg', 8.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Bonito', N'Filete', N'kg', 16.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Jurel', N'Entero', N'kg', 7.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Jurel', N'Filete', N'kg', 14.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Caballa', N'Entera', N'kg', 6.50, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Caballa', N'Filete', N'kg', 13.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Cabrilla', N'Entera', N'kg', 25.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Cabrilla', N'Filete', N'kg', 45.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Cojinova', N'Entera', N'kg', 20.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Cojinova', N'Filete', N'kg', 36.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Mero', N'Filete', N'kg', 75.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Merluza', N'Filete', N'kg', 18.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Perico', N'Filete', N'kg', 30.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Tollo', N'Filete', N'kg', 22.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Pota', N'Filete', N'kg', 14.00, N'REFERENCIA_PUBLICADA', N'F02'), -- S/14/kg; filete de pota congelado en bloques. Confirmar membrana y glaseado.
    (N'Pota', N'Tentáculos', N'kg', 13.50, N'REFERENCIA_PUBLICADA', N'F03'), -- S/13.50/kg; tentáculos de pota limpios congelados.
    (N'Atún', N'Filete', N'kg', 45.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Atún', N'Lomo aleta amarilla', N'kg', 55.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Salmón', N'Filete', N'kg', 65.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Trucha', N'Entera', N'kg', 18.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Trucha', N'Filete', N'kg', 32.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Tilapia', N'Entera', N'kg', 12.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Tilapia', N'Filete', N'kg', 19.90, N'REFERENCIA_PUBLICADA', N'F07'), -- Filete de tilapia congelado, bolsa aproximadamente 1 kg.
    (N'Paiche', N'Filete', N'kg', 45.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Doncella', N'Filete', N'kg', 36.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Lisa', N'Entera', N'kg', 8.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Chita', N'Entera', N'kg', 28.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Lorna', N'Entera', N'kg', 12.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Pintadilla', N'Entera', N'kg', 18.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Robalo', N'Filete', N'kg', 50.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Machete', N'Entero', N'kg', 9.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Anchoveta', N'Entera', N'kg', 5.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Sardina', N'Entera', N'kg', 6.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Cachema', N'Entera', N'kg', 14.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Congrio', N'Filete', N'kg', 38.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Pámpano', N'Entero', N'kg', 28.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Cabeza de pescado', N'Para fumet', N'kg', 4.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Espinas de pescado', N'Para fumet', N'kg', 3.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Conchas negras', N'Con valva', N'kg', 25.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Conchas negras', N'Pulpa', N'kg', 70.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Conchas de abanico', N'Con coral', N'kg', 50.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para carne con coral; no confundir kg de pulpa con kg de producto que incluye valva.
    (N'Conchas de abanico', N'Sin coral', N'kg', 60.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para tallo sin coral; el precio genérico de concha de abanico no identifica esta talla/presentación.
    (N'Pulpo', N'Entero', N'kg', 33.00, N'REFERENCIA_PUBLICADA', N'F04'), -- S/33/kg; pulpo entero congelado, no tentáculo cocido.
    (N'Pulpo', N'Tentáculos', N'kg', 42.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para tentáculo CRUDO; no usar precio de pata cocida con merma de cocción del 35%.
    (N'Calamar', N'Tubo', N'kg', 25.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Calamar', N'Anillas', N'kg', 28.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Calamar', N'Entero', N'kg', 22.00, N'REFERENCIA_PUBLICADA', N'F05'), -- S/22/kg; calamar Loligo entero congelado.
    (N'Camarón', N'Mediano', N'kg', 42.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Camarón', N'Jumbo', N'kg', 60.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Camarón', N'Pelado', N'kg', 55.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Langostino', N'Entero', N'kg', 28.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Langostino', N'Cola pelada', N'kg', 39.90, N'REFERENCIA_PUBLICADA', N'F07'), -- Langostino crudo, pelado y desvenado, 41-50 piezas/lb, bolsa 1 kg.
    (N'Cangrejo', N'Peludo', N'kg', 25.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Cangrejo', N'Violáceo', N'kg', 22.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Cangrejo', N'Pulpa', N'kg', 75.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Cangrejo', N'Pinza', N'kg', 45.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Choros', N'Con valva', N'kg', 8.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Choros', N'Pulpa', N'kg', 25.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Almejas', N'Con valva', N'kg', 18.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Machas', N'Con valva', N'kg', 30.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Navajas', N'Con valva', N'kg', 30.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Erizo', N'Lengua', N'kg', 65.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Langosta', N'Entera', N'kg', 100.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Caracol', N'Cocido', N'kg', 35.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Ostión', N'Con valva', N'kg', 45.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Picoroco', N'Pulpa', N'kg', 25.00, N'ORIGINAL_SIN_VALIDAR', N''), -- Precio original conservado provisionalmente; no se encontró cotización comparable.
    (N'Jaiba', N'Entera', N'kg', 28.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Camarón de río', N'Entero', N'kg', 45.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Chanque', N'Pulpa', N'kg', 28.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Huevas de pescado', N'Frescas', N'kg', 35.00, N'ESTIMADO', N'F04/F05/F06/F07/F20/F21'), -- Estimación para costeo por especie y presentación; las referencias marinas no constituyen cotización exacta de este insumo.
    (N'Mixtura de mariscos', N'Congelada', N'kg', 36.05, N'REFERENCIA_PUBLICADA', N'F07'), -- Mixtura económica congelada, bolsa de 1 kg.
    (N'Res', N'Lomo fino', N'kg', 65.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Res', N'Bistec / Pulpa', N'kg', 32.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Res', N'Carne molida', N'kg', 27.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Res', N'Corazón (anticucho)', N'kg', 16.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Res', N'Hígado', N'kg', 14.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Res', N'Costilla', N'kg', 24.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Res', N'Asado de tira', N'kg', 35.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Res', N'Cabeza de lomo', N'kg', 38.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Res', N'Falda', N'kg', 26.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Res', N'Osobuco', N'kg', 23.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Res', N'Rabo', N'kg', 24.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Res', N'Lengua', N'kg', 28.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Res', N'Panza / Mondongo', N'kg', 15.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Res', N'Pecho', N'kg', 25.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Res', N'Chuleta T-bone', N'kg', 48.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Res', N'Bife ancho', N'kg', 50.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Res', N'Huesos para caldo', N'kg', 6.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Res', N'Charqui', N'kg', 70.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Res', N'Callos', N'kg', 16.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Res', N'Pulpa para guiso', N'kg', 30.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Pollo', N'Entero', N'kg', 9.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Pollo', N'Pechuga', N'kg', 14.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Pollo', N'Pierna / Encuentro', N'kg', 11.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Pollo', N'Ala', N'kg', 12.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Pollo', N'Filete de pechuga', N'kg', 14.90, N'REFERENCIA_PUBLICADA', N'F24'), -- Filete de pechuga SADIA, bolsa de 1 kg, precio publicado unitario.
    (N'Pollo', N'Molleja / Menudencia', N'kg', 9.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Pollo', N'Hígado', N'kg', 7.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Pollo', N'Carcasa / Huesos', N'kg', 3.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Pavo', N'Entero', N'kg', 18.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Pavo', N'Pechuga', N'kg', 28.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Pato', N'Entero', N'kg', 30.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Gallina', N'Entera', N'kg', 18.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Cerdo', N'Chuleta', N'kg', 20.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Cerdo', N'Pulpa', N'kg', 20.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Cerdo', N'Tocino', N'kg', 26.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Cerdo', N'Costilla', N'kg', 25.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Cerdo', N'Panceta', N'kg', 25.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Cerdo', N'Pierna', N'kg', 18.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Cerdo', N'Chicharrón (panza)', N'kg', 23.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Cerdo', N'Cuero', N'kg', 9.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Cordero', N'Pierna', N'kg', 32.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Cordero', N'Costillar', N'kg', 38.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Cabrito', N'Pierna', N'kg', 35.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Cuy', N'Entero', N'kg', 40.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Conejo', N'Entero', N'kg', 30.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Alpaca', N'Lomo', N'kg', 38.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Jamón', N'Del país', N'kg', 28.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Jamón', N'Inglés', N'kg', 35.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Jamonada', N'Corriente', N'kg', 18.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Chorizo', N'Parrillero', N'kg', 28.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Salchicha', N'Huachana', N'kg', 25.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Salchicha', N'Hot dog', N'kg', 16.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Tocino', N'Ahumado', N'kg', 38.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Pepperoni', N'Rebanado', N'kg', 50.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Mortadela', N'Corriente', N'kg', 22.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Longaniza', N'Corriente', N'kg', 26.00, N'ESTIMADO', N'F24'), -- Estimación de trabajo por corte/presentación; no se obtuvo una cotización comparable de este corte.
    (N'Arroz', N'Superior (Costa)', N'kg', 3.37, N'REFERENCIA_PUBLICADA', N'F12'), -- S/165 por saco de arroz superior Cusi Cusa de 49 kg; dividir entre 49. Procedencia Costa no confirmada.
    (N'Arroz', N'Corriente (Costa)', N'kg', 3.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Arroz', N'Extra (Costa)', N'kg', 4.38, N'REFERENCIA_PUBLICADA', N'F13'), -- S/219.13 por saco extra Campero de 50 kg; dividir entre 50. Procedencia Costa no confirmada.
    (N'Arroz', N'Superior (Selva)', N'kg', 3.20, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Arroz', N'Integral', N'kg', 6.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Arroz', N'Arborio (risotto)', N'kg', 18.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Arroz', N'Grano largo', N'kg', 4.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Frijol', N'Canario', N'kg', 8.50, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Frijol', N'Castilla', N'kg', 7.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Frijol', N'Panamito', N'kg', 9.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Frijol', N'Negro', N'kg', 9.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Frijol', N'Caballero', N'kg', 8.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Frijol', N'Bayo', N'kg', 8.50, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Lentejas', N'Bebé', N'kg', 6.50, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Lentejas', N'Serrana', N'kg', 7.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Garbanzo', N'Seco', N'kg', 9.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Pallares', N'Seco', N'kg', 10.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Quinua', N'Blanca', N'kg', 10.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Quinua', N'Roja', N'kg', 12.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Quinua', N'Negra', N'kg', 13.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Maíz', N'Choclo desgranado', N'kg', 8.50, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Maíz', N'Morado', N'kg', 3.65, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Maíz', N'Cancha serrana', N'kg', 5.50, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Maíz', N'Chulpi', N'kg', 6.50, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Maíz', N'Mote', N'kg', 6.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Maíz', N'Canchita (reventón)', N'kg', 6.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Maíz', N'Tostado', N'kg', 9.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Trigo', N'Grano', N'kg', 4.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Cebada', N'Perlada', N'kg', 4.50, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Kiwicha', N'Grano', N'kg', 11.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Avena', N'Hojuelas', N'kg', 6.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Papa', N'Amarilla', N'kg', 4.10, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Papa', N'Canchán', N'kg', 2.11, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Papa', N'Blanca', N'kg', 1.25, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Papa', N'Huayro', N'kg', 2.90, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Papa', N'Peruanita', N'kg', 2.35, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Papa', N'Nativa', N'kg', 3.50, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Papa', N'Yungay', N'kg', 1.25, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Papa', N'Perricholi', N'kg', 1.80, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Papa', N'Prefrita congelada', N'kg', 10.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Papa', N'Seca', N'kg', 13.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Camote', N'Amarillo', N'kg', 1.49, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Camote', N'Morado', N'kg', 1.73, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Camote', N'Anaranjado', N'kg', 1.80, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Yuca', N'Blanca', N'kg', 2.20, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Yuca', N'Congelada', N'kg', 7.50, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Olluco', N'Amarillo', N'kg', 4.28, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Oca', N'Corriente', N'kg', 4.00, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Arracacha', N'Corriente', N'kg', 4.50, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Chuño', N'Negro', N'kg', 12.00, N'ORIGINAL_SIN_VALIDAR', N''), -- Precio original conservado provisionalmente; no se encontró cotización comparable.
    (N'Cebolla', N'Roja', N'kg', 2.75, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Cebolla', N'Blanca', N'kg', 2.48, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Cebolla china', N'Verde', N'kg', 3.88, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Puerro', N'Fresco', N'kg', 3.27, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Ajo', N'Nacional pelado', N'kg', 6.13, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Ajo', N'Cabeza entera', N'kg', 4.00, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Ajo', N'Molido', N'kg', 9.00, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Tomate', N'Italiano', N'kg', 4.50, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Tomate', N'Cherry', N'kg', 6.25, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Tomate', N'Pera', N'kg', 4.20, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Zanahoria', N'Corriente', N'kg', 2.47, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Zanahoria', N'Baby', N'kg', 6.50, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Lechuga', N'Americana', N'kg', 1.54, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Lechuga', N'Crespa', N'kg', 2.50, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Lechuga', N'Romana', N'kg', 1.79, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Lechuga', N'Hidropónica', N'kg', 3.50, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Apio', N'Corriente', N'kg', 4.67, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Pimiento', N'Rojo', N'kg', 4.58, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Pimiento', N'Verde', N'kg', 4.00, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Pimiento', N'Amarillo', N'kg', 5.50, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Brócoli', N'Corriente', N'kg', 3.68, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Coliflor', N'Corriente', N'kg', 1.11, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Espinaca', N'Fresca', N'kg', 1.75, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Vainita', N'Fresca', N'kg', 4.08, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Beterraga', N'Corriente', N'kg', 2.87, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Pepino', N'Corriente', N'kg', 1.67, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Repollo', N'Verde', N'kg', 1.10, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Repollo', N'Morado', N'kg', 2.20, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Choclo', N'Mazorca', N'kg', 5.08, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Arveja', N'Verde en vaina', N'kg', 6.50, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Arveja', N'Pelada', N'kg', 13.00, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Zapallo', N'Macre', N'kg', 1.78, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Zapallo', N'Loche', N'kg', 5.42, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Zapallito', N'Italiano', N'kg', 1.40, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Berenjena', N'Corriente', N'kg', 6.30, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Nabo', N'Corriente', N'kg', 2.75, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Rabanito', N'Rojo', N'kg', 4.57, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Alcachofa', N'Fresca', N'kg', 5.63, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Espárrago', N'Verde', N'kg', 7.00, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Champiñón', N'Fresco', N'kg', 10.00, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Col china', N'Corriente', N'kg', 7.19, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Acelga', N'Fresca', N'kg', 3.75, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Habas', N'Verdes en vaina', N'kg', 1.20, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Habas', N'Peladas', N'kg', 5.00, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Col de Bruselas', N'Fresca', N'kg', 12.00, N'ORIGINAL_SIN_VALIDAR', N''), -- Precio original conservado provisionalmente; no se encontró cotización comparable.
    (N'Brotes de soya', N'Frescos', N'kg', 2.50, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Palmito', N'Fresco', N'kg', 25.00, N'ORIGINAL_SIN_VALIDAR', N''), -- Precio original conservado provisionalmente; no se encontró cotización comparable.
    (N'Kale', N'Col rizada', N'kg', 8.00, N'ORIGINAL_SIN_VALIDAR', N''), -- Precio original conservado provisionalmente; no se encontró cotización comparable.
    (N'Yuyo', N'Alga fresca', N'kg', 20.00, N'ORIGINAL_SIN_VALIDAR', N''), -- Precio original conservado provisionalmente; no se encontró cotización comparable.
    (N'Cochayuyo', N'Alga seca', N'kg', 30.00, N'ORIGINAL_SIN_VALIDAR', N''), -- Precio original conservado provisionalmente; no se encontró cotización comparable.
    (N'Ají', N'Amarillo fresco', N'kg', 5.65, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Ají', N'Amarillo pulpa congelada', N'kg', 12.00, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Ají', N'Amarillo molido', N'kg', 14.00, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Ají', N'Limo', N'kg', 10.00, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Ají', N'Rocoto', N'kg', 4.58, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Ají', N'Panca seco', N'kg', 16.63, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Ají', N'Panca molido', N'kg', 20.00, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Ají', N'Mirasol seco', N'kg', 17.00, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Ají', N'Charapita', N'kg', 60.00, N'ORIGINAL_SIN_VALIDAR', N''), -- Precio original conservado provisionalmente; no se encontró cotización comparable.
    (N'Ají', N'Cerezo', N'kg', 10.00, N'ORIGINAL_SIN_VALIDAR', N''), -- Precio original conservado provisionalmente; no se encontró cotización comparable.
    (N'Ají', N'Pipí de mono', N'kg', 35.00, N'ORIGINAL_SIN_VALIDAR', N''), -- Precio original conservado provisionalmente; no se encontró cotización comparable.
    (N'Ají', N'Verde jalapeño', N'kg', 6.00, N'ORIGINAL_SIN_VALIDAR', N''), -- Precio original conservado provisionalmente; no se encontró cotización comparable.
    (N'Culantro', N'Fresco', N'kg', 3.17, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Perejil', N'Crespo', N'kg', 2.70, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Perejil', N'Liso', N'kg', 3.00, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Huacatay', N'Fresco', N'kg', 2.98, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Huacatay', N'Pasta', N'kg', 18.00, N'ORIGINAL_SIN_VALIDAR', N''), -- Precio original conservado provisionalmente; no se encontró cotización comparable.
    (N'Hierbabuena', N'Fresca', N'kg', 2.09, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Albahaca', N'Fresca', N'kg', 4.93, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Romero', N'Fresco', N'kg', 9.25, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Tomillo', N'Fresco', N'kg', 22.00, N'ORIGINAL_SIN_VALIDAR', N''), -- Precio original conservado provisionalmente; no se encontró cotización comparable.
    (N'Orégano', N'Fresco', N'kg', 12.17, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Menta', N'Fresca', N'kg', 11.13, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Kión', N'Fresco', N'kg', 3.18, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Cúrcuma', N'Fresca', N'kg', 10.00, N'ORIGINAL_SIN_VALIDAR', N''), -- Precio original conservado provisionalmente; no se encontró cotización comparable.
    (N'Hierba luisa', N'Fresca', N'kg', 1.81, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Chincho', N'Fresco', N'kg', 12.00, N'ORIGINAL_SIN_VALIDAR', N''), -- Precio original conservado provisionalmente; no se encontró cotización comparable.
    (N'Muña', N'Fresca', N'kg', 8.00, N'ORIGINAL_SIN_VALIDAR', N''), -- Precio original conservado provisionalmente; no se encontró cotización comparable.
    (N'Paico', N'Fresco', N'kg', 6.00, N'ORIGINAL_SIN_VALIDAR', N''), -- Precio original conservado provisionalmente; no se encontró cotización comparable.
    (N'Cebollino', N'Fresco', N'kg', 8.00, N'ORIGINAL_SIN_VALIDAR', N''), -- Precio original conservado provisionalmente; no se encontró cotización comparable.
    (N'Eneldo', N'Fresco', N'kg', 20.00, N'ORIGINAL_SIN_VALIDAR', N''), -- Precio original conservado provisionalmente; no se encontró cotización comparable.
    (N'Limón', N'Sutil', N'kg', 3.00, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Limón', N'Tahití', N'kg', 3.50, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Palta', N'Hass', N'kg', 8.50, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Palta', N'Fuerte', N'kg', 7.63, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Plátano', N'De seda', N'kg', 2.07, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Plátano', N'Verde (freír)', N'kg', 2.80, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Plátano', N'Isla', N'kg', 2.73, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Plátano', N'Bellaco', N'kg', 3.20, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Naranja', N'De jugo', N'kg', 1.80, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Naranja', N'De mesa', N'kg', 3.00, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Mandarina', N'Corriente', N'kg', 2.98, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Toronja', N'Corriente', N'kg', 6.50, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Maracuyá', N'Corriente', N'kg', 4.38, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Piña', N'Golden', N'kg', 2.10, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Papaya', N'Corriente', N'kg', 3.70, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Fresa', N'Fresca', N'kg', 9.00, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Mango', N'Kent', N'kg', 6.50, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Mango', N'Criollo', N'kg', 7.63, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Manzana', N'Delicia', N'kg', 4.75, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Manzana', N'Verde Granny', N'kg', 9.00, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Uva', N'Red Globe', N'kg', 6.00, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Uva', N'Italia', N'kg', 5.50, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Sandía', N'Corriente', N'kg', 1.60, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Melón', N'Corriente', N'kg', 3.55, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Durazno', N'Corriente', N'kg', 7.00, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Pera', N'De agua', N'kg', 7.63, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Chirimoya', N'Corriente', N'kg', 6.63, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Lúcuma', N'Corriente', N'kg', 10.50, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Granadilla', N'Corriente', N'kg', 5.25, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Tuna', N'Corriente', N'kg', 8.50, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Aguaymanto', N'Fresco', N'kg', 5.00, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Arándano', N'Fresco', N'kg', 21.00, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Cocona', N'Corriente', N'kg', 3.28, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Camu camu', N'Fresco', N'kg', 6.00, N'ORIGINAL_SIN_VALIDAR', N''), -- Precio original conservado provisionalmente; no se encontró cotización comparable.
    (N'Coco', N'Seco', N'kg', 8.00, N'ORIGINAL_SIN_VALIDAR', N''), -- Precio original conservado provisionalmente; no se encontró cotización comparable.
    (N'Guanábana', N'Corriente', N'kg', 7.25, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Tumbo', N'Corriente', N'kg', 6.00, N'ORIGINAL_SIN_VALIDAR', N''), -- Precio original conservado provisionalmente; no se encontró cotización comparable.
    (N'Higo', N'Fresco', N'kg', 10.00, N'ORIGINAL_SIN_VALIDAR', N''), -- Precio original conservado provisionalmente; no se encontró cotización comparable.
    (N'Mora', N'Fresca', N'kg', 14.00, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Membrillo', N'Corriente', N'kg', 5.25, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Cereza', N'Fresca', N'kg', 30.00, N'ORIGINAL_SIN_VALIDAR', N''), -- Precio original conservado provisionalmente; no se encontró cotización comparable.
    (N'Kiwi', N'Corriente', N'kg', 16.00, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Ciruela', N'Corriente', N'kg', 7.00, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Guayaba', N'Corriente', N'kg', 6.00, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Pitahaya', N'Corriente', N'kg', 16.75, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Huevo', N'Pardo (por kg)', N'kg', 7.50, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Huevo', N'Blanco (por kg)', N'kg', 7.20, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Huevo', N'Codorniz', N'kg', 20.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Queso', N'Fresco', N'kg', 24.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Queso', N'Parmesano', N'kg', 57.80, N'REFERENCIA_PUBLICADA', N'F10'), -- Parmesano rallado ICO Foods: S/28.90 por 500 g; dividir entre 0.5.
    (N'Queso', N'Mozzarella', N'kg', 32.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Queso', N'Edam', N'kg', 38.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Queso', N'Paria', N'kg', 28.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Queso', N'Andino', N'kg', 30.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Queso', N'Crema', N'kg', 35.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Queso', N'Serrano', N'kg', 28.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Queso', N'Ricotta', N'kg', 26.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Queso', N'Manchego', N'kg', 55.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Requesón', N'Fresco', N'kg', 18.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Mantequilla', N'Sin sal', N'kg', 49.39, N'REFERENCIA_PUBLICADA', N'F11'), -- Mantequilla sin sal Laive: S/296.35 por caja de 6 kg; dividir entre 6.
    (N'Mantequilla', N'Con sal', N'kg', 49.44, N'REFERENCIA_PUBLICADA', N'F11'), -- Mantequilla con sal Laive: S/296.64 por caja de 6 kg; dividir entre 6.
    (N'Margarina', N'Culinaria', N'kg', 12.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Crema de leche', N'Fresca', N'Litro', 24.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Leche', N'Fresca', N'Litro', 4.50, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Leche', N'Evaporada', N'Litro', 10.95, N'ESTIMADO', N'F19'), -- Leche evaporada: referencia S/23.30 por 2.34 kg. Conversión a litro estimada con densidad 1.10 kg/L; confirmar volumen real del proveedor.
    (N'Leche', N'Condensada', N'kg', 16.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Leche', N'En polvo', N'kg', 32.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Yogurt', N'Natural', N'kg', 8.50, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Aceite', N'Vegetal', N'Litro', 8.57, N'REFERENCIA_PUBLICADA', N'F08'), -- Aceite Deleite de 5 litros a S/42.86 para negocios; dividir entre 5.
    (N'Aceite', N'Oliva', N'Litro', 40.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Aceite', N'Oliva extra virgen', N'Litro', 49.30, N'REFERENCIA_PUBLICADA', N'F08'), -- Aceite oliva extra virgen de 5 litros a S/246.50; dividir entre 5.
    (N'Aceite', N'Girasol', N'Litro', 10.50, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Aceite', N'Sésamo', N'Litro', 65.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Manteca', N'Vegetal', N'kg', 12.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Azúcar', N'Rubia', N'kg', 3.80, N'REFERENCIA_PUBLICADA', N'F14'), -- S/190 por saco de azúcar rubia de 50 kg; dividir entre 50.
    (N'Azúcar', N'Blanca', N'kg', 4.00, N'REFERENCIA_PUBLICADA', N'F14'), -- S/200 por saco de azúcar blanca de 50 kg; dividir entre 50.
    (N'Azúcar', N'Impalpable', N'kg', 6.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Chancaca', N'Pan', N'kg', 7.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Miel', N'De abeja', N'kg', 30.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Sal', N'De mesa', N'kg', 1.70, N'REFERENCIA_PUBLICADA', N'F27'), -- Sal de mesa EMSAL de 1 kg a S/1.70; precio publicado de distribuidor.
    (N'Sal', N'Marina', N'kg', 2.50, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Sal', N'De Maras', N'kg', 10.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Sal', N'Gruesa', N'kg', 2.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Pimienta', N'Negra molida', N'kg', 69.80, N'REFERENCIA_PUBLICADA', N'F17'), -- Pimienta negra molida ARO: S/34.90 por 500 g; dividir entre 0.5.
    (N'Pimienta', N'Negra en grano', N'kg', 65.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Pimienta', N'Blanca', N'kg', 80.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Comino', N'Molido', N'kg', 39.80, N'REFERENCIA_PUBLICADA', N'F17'), -- Comino molido ARO: S/19.90 por 500 g; dividir entre 0.5.
    (N'Comino', N'En grano', N'kg', 35.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Orégano', N'Seco', N'kg', 13.25, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Ajo', N'En polvo', N'kg', 35.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Cebolla', N'En polvo', N'kg', 30.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Cúrcuma', N'Molida (palillo)', N'kg', 25.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Pimentón', N'Molido', N'kg', 28.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Páprika', N'Molida', N'kg', 28.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Canela', N'Molida', N'kg', 50.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Canela', N'En rama', N'kg', 55.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Clavo de olor', N'Entero', N'kg', 85.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Anís estrellado', N'Entero', N'kg', 80.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Nuez moscada', N'Entera', N'kg', 100.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Laurel', N'Hoja seca', N'kg', 40.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Achiote', N'Molido', N'kg', 20.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Kión', N'Molido', N'kg', 40.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Ají', N'En polvo', N'kg', 24.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Tomillo', N'Seco', N'kg', 45.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Romero', N'Seco', N'kg', 45.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Ajonjolí', N'Blanco', N'kg', 10.13, N'REFERENCIA_PUBLICADA', N'F01'), -- Promedio referencial mayorista Lima 12/10/2026; verificar equivalencia de variedad/calidad.
    (N'Mostaza', N'En grano', N'kg', 30.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Curry', N'En polvo', N'kg', 45.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Sazonador', N'Sazón completa', N'kg', 32.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Glutamato', N'Monosódico', N'kg', 15.20, N'REFERENCIA_PUBLICADA', N'F26'), -- AJI-NO-MOTO, bolsa de 1 kg a S/15.20.
    (N'Caldo', N'De gallina en cubos', N'kg', 28.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Caldo', N'De res en cubos', N'kg', 30.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Sillao', N'Salsa de soya', N'Litro', 6.90, N'REFERENCIA_PUBLICADA', N'F15'), -- Botella de sillao de 1 litro a S/6.90.
    (N'Salsa de ostión', N'Botella', N'Litro', 28.80, N'ESTIMADO', N'F16'), -- Referencia LKK S/50.27 por 2.27 kg; estimación por litro con densidad supuesta 1.30 kg/L. Confirmar densidad y marca.
    (N'Vinagre', N'Blanco', N'Litro', 4.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Vinagre', N'Tinto', N'Litro', 5.50, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Vinagre', N'Balsámico', N'Litro', 35.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Vinagre', N'De manzana', N'Litro', 12.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Vinagre', N'De arroz', N'Litro', 18.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Harina', N'De trigo sin preparar', N'kg', 3.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Harina', N'Preparada', N'kg', 4.50, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Harina', N'Panadera', N'kg', 2.10, N'REFERENCIA_PUBLICADA', N'F25'), -- Harina panadera Del Cielo: S/104.82 por saco de 50 kg; dividir entre 50.
    (N'Harina', N'De maíz', N'kg', 5.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Harina', N'De arroz', N'kg', 8.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Harina', N'De yuca', N'kg', 7.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Fécula', N'De maíz (maicena)', N'kg', 7.50, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Pan', N'Francés', N'kg', 8.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Pan', N'De molde', N'kg', 12.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Pan', N'Rallado', N'kg', 10.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Pan', N'Ciabatta', N'kg', 14.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Pan', N'Hamburguesa', N'kg', 12.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Fideos', N'Tallarín', N'kg', 5.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Fideos', N'Spaghetti', N'kg', 5.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Fideos', N'Canutos', N'kg', 5.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Fideos', N'Tornillo', N'kg', 5.50, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Fideos', N'Lasagna', N'kg', 12.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Fideos', N'Cabello de ángel', N'kg', 5.50, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Masa', N'Para wantán', N'kg', 10.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Masa', N'Para pizza', N'kg', 10.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Levadura', N'Fresca', N'kg', 15.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Levadura', N'Seca', N'kg', 38.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Polvo de hornear', N'Corriente', N'kg', 20.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Bicarbonato', N'De sodio', N'kg', 10.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Gelatina', N'Sin sabor', N'kg', 60.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Galleta', N'De soda', N'kg', 12.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Galleta', N'María', N'kg', 12.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Mayonesa', N'Corriente', N'kg', 9.57, N'REFERENCIA_PUBLICADA', N'F09'), -- Mayonesa base de 4 kg a S/38.29; dividir entre 4.
    (N'Ketchup', N'Corriente', N'kg', 5.30, N'REFERENCIA_PUBLICADA', N'F26'), -- Ketchup Walibi de 4 kg a S/21.18; dividir entre 4.
    (N'Mostaza', N'Preparada', N'kg', 10.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Salsa', N'Tártara', N'kg', 18.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Aceituna', N'Botija', N'kg', 25.00, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Aceituna', N'Verde', N'kg', 18.00, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Aceituna', N'Negra', N'kg', 21.75, N'ESTIMADO', N'F01'), -- Estimación por producto agrícola análogo y/o presentación procesada. La fuente no publica el precio exacto de esta variedad.
    (N'Alcaparras', N'En salmuera', N'kg', 45.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Pepinillos', N'En vinagre', N'kg', 20.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Atún', N'Enlatado en filete', N'kg', 49.80, N'ESTIMADO', N'F18'), -- Lata de filete a S/4.98 por 140 g netos: S/35.57/kg neto. Se asumen 100 g escurridos por lata para receta: S/49.80/kg. Confirmar etiqueta.
    (N'Atún', N'Enlatado en trozos', N'kg', 49.00, N'ESTIMADO', N'F07'), -- Lata de trozos a S/4.90 por 140 g netos; se asumen 100 g escurridos para receta. Confirmar peso escurrido.
    (N'Sardina', N'Enlatada', N'kg', 18.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Choclo', N'Enlatado', N'kg', 16.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Espárrago', N'Enlatado', N'kg', 25.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Champiñón', N'Enlatado', N'kg', 20.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Pasta de tomate', N'Corriente', N'kg', 12.42, N'REFERENCIA_PUBLICADA', N'F26'), -- Pasta de tomate Walibi de 4 kg a S/49.66; dividir entre 4.
    (N'Tomate', N'Pelado enlatado', N'kg', 14.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Salsa de tomate', N'Corriente', N'kg', 10.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Crema', N'De huancaína', N'kg', 20.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Crema', N'De rocoto', N'kg', 22.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Crema', N'De ají amarillo', N'kg', 22.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Pasta', N'De ají panca', N'kg', 20.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Pasta', N'De ají amarillo', N'kg', 18.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Chimichurri', N'Preparado', N'kg', 22.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Salsa', N'BBQ', N'kg', 16.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Leche de tigre', N'Preparada', N'Litro', 28.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Salsa', N'De tamarindo', N'kg', 18.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Wasabi', N'Pasta', N'kg', 90.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Alga nori', N'Hojas', N'kg', 180.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Jengibre', N'Encurtido', N'kg', 40.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Pisco', N'Quebranta', N'Litro', 45.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Pisco', N'Acholado', N'Litro', 48.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Pisco', N'Italia', N'Litro', 52.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Pisco', N'Mosto verde', N'Litro', 65.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Ron', N'Blanco', N'Litro', 40.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Ron', N'Añejo', N'Litro', 55.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Vodka', N'Corriente', N'Litro', 45.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Whisky', N'Corriente', N'Litro', 70.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Vino', N'Tinto de mesa', N'Litro', 22.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Vino', N'Blanco de mesa', N'Litro', 22.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Vino', N'Espumante', N'Litro', 40.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Cerveza', N'Lager', N'Litro', 10.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Cerveza', N'Artesanal', N'Litro', 20.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Chicha morada', N'Concentrado', N'Litro', 10.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Chicha de jora', N'Fresca', N'Litro', 6.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Maracuyá', N'Pulpa congelada', N'kg', 14.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Fresa', N'Pulpa congelada', N'kg', 15.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Limón', N'Jugo embotellado', N'Litro', 16.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Gaseosa', N'Cola', N'Litro', 4.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Gaseosa', N'Amarilla', N'Litro', 4.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Agua', N'Mineral con gas', N'Litro', 3.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Agua', N'Sin gas', N'Litro', 2.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Agua', N'De coco', N'Litro', 12.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Jarabe', N'De goma', N'Litro', 10.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Jugo', N'De naranja', N'Litro', 8.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Amargo', N'De angostura', N'Litro', 427.50, N'REFERENCIA_PUBLICADA', N'F23'), -- Angostura Aromatic Bitters S/85.50 por 200 ml; dividir entre 0.2. Referencia minorista de marca importada.
    (N'Triple sec', N'Licor de naranja', N'Litro', 50.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Hielo', N'En barra', N'kg', 2.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Ginger ale', N'Corriente', N'Litro', 5.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Té', N'Filtrante', N'kg', 100.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Café', N'Molido', N'kg', 60.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Café', N'En grano', N'kg', 55.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Manzanilla', N'Filtrante', N'kg', 80.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Maní', N'Tostado', N'kg', 14.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Maní', N'Pelado', N'kg', 14.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Maní', N'Molido', N'kg', 18.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Nuez', N'Pelada', N'kg', 48.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Almendra', N'Laminada', N'kg', 55.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Pecanas', N'Peladas', N'kg', 65.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Pistacho', N'Pelado', N'kg', 100.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Castaña', N'Pelada', N'kg', 60.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Pasas', N'Negras', N'kg', 18.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Pasas', N'Rubias', N'kg', 22.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Coco', N'Rallado', N'kg', 25.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Chía', N'Semilla', N'kg', 20.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Linaza', N'Semilla', N'kg', 12.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Chifle', N'De plátano', N'kg', 28.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Camote', N'Chips', N'kg', 32.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Esencia', N'De vainilla', N'Litro', 65.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Leche', N'De coco', N'Litro', 22.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Gelatina', N'Con sabor', N'kg', 18.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Chuño', N'Fécula', N'kg', 10.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Piña', N'Enlatada', N'kg', 18.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Durazno', N'Enlatado', N'kg', 20.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Crema', N'Chantilly', N'Litro', 28.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Chocolate', N'Cobertura', N'kg', 28.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Chocolate', N'En barra', N'kg', 35.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Cocoa', N'En polvo', N'kg', 32.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Manjar', N'Blanco', N'kg', 18.00, N'ESTIMADO', N''), -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.
    (N'Mermelada', N'De fresa', N'kg', 12.00, N'ESTIMADO', N''); -- Estimación de trabajo para simulación; confirmar proveedor, calidad y presentación.

DECLARE @cambios_precios TABLE (
    id_insumo INT,
    nombre NVARCHAR(100),
    variedad NVARCHAR(100),
    precio_anterior DECIMAL(10,2),
    precio_nuevo DECIMAL(10,2)
);

BEGIN TRY
    BEGIN TRANSACTION;

    IF EXISTS (
        SELECT 1
        FROM @precios_revision p
        WHERE NOT EXISTS (
            SELECT 1
            FROM dbo.insumos i
            JOIN dbo.unidades_medida u ON u.id_unidad = i.id_unidad
            WHERE i.nombre = p.nombre
              AND i.variedad = p.variedad
              AND u.codigo = p.unidad_base
        )
    )
        THROW 50002, N'No coincide todo el catálogo de precios con nombre, variedad y unidad. No se aplicó la actualización de precios.', 1;

    UPDATE i
    SET i.precio_mayorista = p.precio,
        i.fecha_actualizacion = GETDATE()
    OUTPUT inserted.id_insumo, inserted.nombre, inserted.variedad,
           deleted.precio_mayorista, inserted.precio_mayorista
    INTO @cambios_precios
    FROM dbo.insumos i
    JOIN dbo.unidades_medida u ON u.id_unidad = i.id_unidad
    JOIN @precios_revision p ON p.nombre = i.nombre
                           AND p.variedad = i.variedad
                           AND p.unidad_base = u.codigo
    WHERE i.precio_mayorista <> p.precio;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

-- En una base nueva ya se insertaron los precios revisados y esta lista queda
-- vacía. En una base existente muestra los cambios efectivamente aplicados.
SELECT id_insumo, nombre, variedad, precio_anterior, precio_nuevo
FROM @cambios_precios
ORDER BY id_insumo;

-- Procedencia de los 500 valores. Consultar las notas de cada fila y las URLs.
SELECT p.nombre, p.variedad, p.unidad_base, p.precio AS precio_referencial,
       p.criterio, p.referencia
FROM @precios_revision p
ORDER BY p.criterio, p.nombre, p.variedad;
GO

-- Comprobación rápida: costo estándar de materia prima por porción
SELECT id_plato_local, nombre, porciones, lineas_receta, costo_receta, costo_por_porcion
FROM dbo.vista_plato_costo_estandar
WHERE id_plato_local BETWEEN 1 AND 20
ORDER BY id_plato_local;
GO

-- ============================================================================
-- 7. INVENTARIO INICIAL DE APERTURA - CEVICHERÍA MEDIANA EN LIMA
-- Escenario de trabajo: 60 comensales/día, 60 porciones de platos principales
-- (la jalea rinde 2) y 22 preparaciones adicionales = 80 recetas completas/día.
-- La distribución de ventas es una HIPÓTESIS; no es un estándar del sector.
-- Cobertura: pescado fresco 1 día; ciertos mariscos crudos congelados 2 días;
-- vegetales frescos 2 días; abarrotes 7 días. Ajustes por envase documentados.
-- Días de cobertura son horizonte de compra, NO vencimiento ni vida útil.
-- Reserva de demanda: 10%, adicional a la merma de cada receta.
-- Cantidad inicial = redondeo a paso de compra del mayor entre:
--   (consumo diario bruto * días * 1.10) y mínimo operativo/envase.
-- 65 ingredientes de recetas + 6 productos de servicio. Los demás insumos
-- del catálogo quedan en 0: no se programó su compra para este menú inicial.
-- Unidad: siempre kg o Litro del insumo. Huevo se almacena en kg, no unidades.
-- Corvina/merluza/jurel en FILETE, atún en kg ESCURRIDO según hipótesis de precio.
-- El hielo destinado al contacto con alimentos debe ser de agua potable.
-- Pescados/mariscos: preservar la cadena de frío y seguir conservación del
-- proveedor. Fuente: SANIPES, orientación vigente consultada 13/10/2026:
-- https://www.gob.pe/65241-para-comer-sano-y-seguro
-- https://www.gob.pe/institucion/sanipes/noticias/1393089-sanipes-brinda-recomendaciones-para-comprar-pescados-y-mariscos-seguros-y-frescos
-- Este es inventario de materia prima; no incluye equipos, menaje, limpieza,
-- caja, personal, alquiler o gastos de apertura. Precios siguen referenciales.
-- stock_inicial es la apertura histórica/planteada; NO se descuenta al vender.
-- Re-ejecución: solo completa stock_inicial NULL. Preserva cantidades ya
-- definidas, incluso 0. Los futuros insumos NULL quedan pendientes de plan.
-- ============================================================================

IF COL_LENGTH(N'dbo.insumos', N'stock_inicial') IS NULL
    ALTER TABLE dbo.insumos ADD stock_inicial DECIMAL(14,3) NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = N'CK_insumos_stock_inicial'
      AND parent_object_id = OBJECT_ID(N'dbo.insumos')
)
    ALTER TABLE dbo.insumos WITH CHECK
        ADD CONSTRAINT CK_insumos_stock_inicial CHECK (stock_inicial >= 0);
GO

-- Cambiar estos parámetros ANTES de la primera inicialización si se conoce
-- una demanda diferente. No sobrescriben un stock ya definido al reejecutar.
DECLARE @comensales_apertura INT = 60;
DECLARE @reserva_demanda_pct DECIMAL(5,2) = 10.00;
DECLARE @instalacion_apertura NVARCHAR(36) = N'CATALOGO-BASE';
DECLARE @restaurante_apertura INT = 0;

IF @comensales_apertura <= 0 OR @reserva_demanda_pct < 0
    THROW 50003, N'Comensales debe ser positivo y la reserva no negativa.', 1;

DECLARE @factor_comensales DECIMAL(18,6) = @comensales_apertura / 60.0;
DECLARE @menu_apertura TABLE (
    id_plato_local INT NOT NULL PRIMARY KEY,
    pedidos_dia_base INT NOT NULL CHECK (pedidos_dia_base > 0)
);
INSERT INTO @menu_apertura (id_plato_local, pedidos_dia_base) VALUES
    (1, 12),
    (2, 8),
    (3, 2),
    (4, 4),
    (5, 3),
    (6, 7),
    (7, 4),
    (8, 2),
    (9, 2),
    (10, 2),
    (11, 5),
    (12, 3),
    (13, 3),
    (14, 2),
    (15, 5),
    (16, 3),
    (17, 2),
    (18, 3),
    (19, 5),
    (20, 3);

DECLARE @politicas_apertura TABLE (
    nombre NVARCHAR(100) NOT NULL,
    variedad NVARCHAR(100) NOT NULL,
    unidad_base NVARCHAR(20) NOT NULL,
    dias_cobertura SMALLINT NOT NULL CHECK (dias_cobertura > 0),
    paso_compra DECIMAL(14,3) NOT NULL CHECK (paso_compra > 0),
    minimo_base DECIMAL(14,3) NOT NULL CHECK (minimo_base >= 0),
    observacion NVARCHAR(300) NOT NULL,
    PRIMARY KEY (nombre, variedad, unidad_base)
);
INSERT INTO @politicas_apertura
    (nombre, variedad, unidad_base, dias_cobertura, paso_compra, minimo_base, observacion)
VALUES
    (N'Corvina', N'Filete', N'kg', 1, 0.500, 0.000, N'Corvina FILETE: compra para un día y reposición diaria; no equivale al peso de pescado entero.'),
    (N'Jurel', N'Filete', N'kg', 1, 0.500, 0.000, N'Jurel FILETE: compra para un día y reposición diaria.'),
    (N'Merluza', N'Filete', N'kg', 1, 0.500, 0.000, N'Merluza FILETE: compra para un día y reposición diaria.'),
    (N'Pota', N'Filete', N'kg', 2, 0.500, 0.000, N'Reserva para 2 días suponiendo producto CRUDO congelado; descongelar solo la demanda del día.'),
    (N'Cabeza de pescado', N'Para fumet', N'kg', 1, 0.500, 0.000, N'Compra para un día; presentación CRUDA de la receta. No supone vida útil garantizada.'),
    (N'Espinas de pescado', N'Para fumet', N'kg', 1, 0.500, 0.000, N'Compra para un día; presentación CRUDA de la receta. No supone vida útil garantizada.'),
    (N'Conchas negras', N'Pulpa', N'kg', 1, 0.500, 0.000, N'Compra para un día; presentación CRUDA de la receta. No supone vida útil garantizada.'),
    (N'Conchas de abanico', N'Con coral', N'kg', 1, 0.500, 0.000, N'Compra para un día; presentación CRUDA de la receta. No supone vida útil garantizada.'),
    (N'Conchas de abanico', N'Sin coral', N'kg', 1, 0.500, 0.000, N'Compra para un día; presentación CRUDA de la receta. No supone vida útil garantizada.'),
    (N'Pulpo', N'Tentáculos', N'kg', 1, 0.500, 0.000, N'Compra para un día; presentación CRUDA de la receta. No supone vida útil garantizada.'),
    (N'Calamar', N'Anillas', N'kg', 2, 0.500, 0.000, N'Reserva para 2 días suponiendo producto CRUDO congelado; descongelar solo la demanda del día.'),
    (N'Camarón', N'Pelado', N'kg', 2, 0.500, 0.000, N'Reserva para 2 días suponiendo producto CRUDO congelado; descongelar solo la demanda del día.'),
    (N'Langostino', N'Cola pelada', N'kg', 2, 0.500, 0.000, N'Reserva para 2 días suponiendo producto CRUDO congelado; descongelar solo la demanda del día.'),
    (N'Cangrejo', N'Violáceo', N'kg', 1, 0.500, 0.000, N'Compra para un día; presentación CRUDA de la receta. No supone vida útil garantizada.'),
    (N'Choros', N'Con valva', N'kg', 1, 0.500, 0.000, N'Compra para un día; presentación CRUDA de la receta. No supone vida útil garantizada.'),
    (N'Choros', N'Pulpa', N'kg', 1, 0.500, 0.000, N'Compra para un día; presentación CRUDA de la receta. No supone vida útil garantizada.'),
    (N'Arroz', N'Superior (Costa)', N'kg', 7, 25.000, 25.000, N'Saco de arroz de 25 kg; el tamaño de compra puede exceder el consumo de 7 días.'),
    (N'Maíz', N'Choclo desgranado', N'kg', 2, 0.500, 0.000, N'Choclo desgranado: horizonte de 2 días; no duplicar con la mazorca de otras recetas.'),
    (N'Maíz', N'Cancha serrana', N'kg', 7, 1.000, 1.000, N'Cancha seca: redondear compra a kilogramos completos.'),
    (N'Papa', N'Amarilla', N'kg', 2, 0.500, 0.000, N'Horizonte de abastecimiento estimado; verificar rotación y almacenamiento.'),
    (N'Camote', N'Amarillo', N'kg', 2, 0.500, 0.000, N'Horizonte de abastecimiento estimado; verificar rotación y almacenamiento.'),
    (N'Yuca', N'Blanca', N'kg', 2, 0.500, 0.000, N'Horizonte de abastecimiento estimado; verificar rotación y almacenamiento.'),
    (N'Cebolla', N'Roja', N'kg', 2, 0.500, 0.000, N'Horizonte de abastecimiento estimado; verificar rotación y almacenamiento.'),
    (N'Cebolla china', N'Verde', N'kg', 2, 0.500, 0.000, N'Horizonte de abastecimiento estimado; verificar rotación y almacenamiento.'),
    (N'Ajo', N'Nacional pelado', N'kg', 2, 0.250, 0.250, N'Compra de vegetales/condimentos frescos, redondeada a 250 g.'),
    (N'Ajo', N'Molido', N'kg', 2, 0.250, 0.250, N'Compra de vegetales/condimentos frescos, redondeada a 250 g.'),
    (N'Tomate', N'Italiano', N'kg', 2, 0.500, 0.000, N'Horizonte de abastecimiento estimado; verificar rotación y almacenamiento.'),
    (N'Lechuga', N'Americana', N'kg', 2, 0.500, 0.000, N'Horizonte de abastecimiento estimado; verificar rotación y almacenamiento.'),
    (N'Apio', N'Corriente', N'kg', 2, 0.500, 0.000, N'Horizonte de abastecimiento estimado; verificar rotación y almacenamiento.'),
    (N'Pimiento', N'Rojo', N'kg', 2, 0.500, 0.000, N'Horizonte de abastecimiento estimado; verificar rotación y almacenamiento.'),
    (N'Choclo', N'Mazorca', N'kg', 2, 0.500, 0.000, N'Horizonte de abastecimiento estimado; verificar rotación y almacenamiento.'),
    (N'Arveja', N'Pelada', N'kg', 2, 0.500, 0.000, N'Horizonte de abastecimiento estimado; verificar rotación y almacenamiento.'),
    (N'Brotes de soya', N'Frescos', N'kg', 2, 0.500, 0.000, N'Horizonte de abastecimiento estimado; verificar rotación y almacenamiento.'),
    (N'Ají', N'Limo', N'kg', 2, 0.250, 0.250, N'Compra de vegetales/condimentos frescos, redondeada a 250 g.'),
    (N'Ají', N'Panca molido', N'kg', 2, 0.500, 0.000, N'Horizonte de abastecimiento estimado; verificar rotación y almacenamiento.'),
    (N'Culantro', N'Fresco', N'kg', 2, 0.100, 0.100, N'Compra fresca, redondeada a 100 g.'),
    (N'Kión', N'Fresco', N'kg', 2, 0.100, 0.100, N'Compra fresca, redondeada a 100 g.'),
    (N'Limón', N'Sutil', N'kg', 2, 0.500, 0.000, N'Horizonte de abastecimiento estimado; verificar rotación y almacenamiento.'),
    (N'Palta', N'Hass', N'kg', 2, 0.500, 0.000, N'Horizonte de abastecimiento estimado; verificar rotación y almacenamiento.'),
    (N'Huevo', N'Pardo (por kg)', N'kg', 3, 0.060, 1.800, N'Bandeja inicial de 30 huevos, con peso supuesto de 60 g por unidad: 1.800 kg.'),
    (N'Queso', N'Fresco', N'kg', 3, 0.500, 0.500, N'Queso fresco: compra refrigerada en múltiplos de 500 g.'),
    (N'Queso', N'Parmesano', N'kg', 7, 0.500, 0.500, N'Parmesano: paquetes de 500 g; seguir conservación de la etiqueta.'),
    (N'Mantequilla', N'Sin sal', N'kg', 7, 1.000, 1.000, N'Mantequilla: compra inicial en kg; respetar refrigeración indicada por el fabricante.'),
    (N'Leche', N'Evaporada', N'Litro', 7, 1.000, 1.000, N'Leche evaporada: litros equivalentes según la conversión de precios; verificar volumen real de las latas.'),
    (N'Aceite', N'Vegetal', N'Litro', 7, 5.000, 10.000, N'Aceite vegetal: bidones de 5 L; mínimo 10 L para el arranque. Ajustar a la capacidad real de freidoras.'),
    (N'Aceite', N'Oliva', N'Litro', 7, 1.000, 1.000, N'Aceite de oliva: botella de 1 L.'),
    (N'Azúcar', N'Rubia', N'kg', 7, 5.000, 5.000, N'Azúcar rubia: 5 kg para bebidas; cantidad de servicio estimada.'),
    (N'Sal', N'De mesa', N'kg', 7, 1.000, 1.000, N'Sal: bolsas de 1 kg.'),
    (N'Pimienta', N'Negra molida', N'kg', 7, 0.250, 0.250, N'Condimento seco: presentación inicial de 250 g; horizonte de 7 días.'),
    (N'Comino', N'Molido', N'kg', 7, 0.250, 0.250, N'Condimento seco: presentación inicial de 250 g; horizonte de 7 días.'),
    (N'Orégano', N'Seco', N'kg', 7, 0.250, 0.250, N'Condimento seco: presentación inicial de 250 g; horizonte de 7 días.'),
    (N'Sillao', N'Salsa de soya', N'Litro', 7, 1.000, 1.000, N'Sillao: botellas de 1 L.'),
    (N'Salsa de ostión', N'Botella', N'Litro', 7, 0.500, 0.500, N'Salsa de ostión: litros equivalentes, revisar conversión de densidad del precio.'),
    (N'Harina', N'De trigo sin preparar', N'kg', 7, 1.000, 1.000, N'Harina, fécula o pan rallado: compra en bolsas de 1 kg.'),
    (N'Fécula', N'De maíz (maicena)', N'kg', 7, 1.000, 1.000, N'Harina, fécula o pan rallado: compra en bolsas de 1 kg.'),
    (N'Pan', N'Rallado', N'kg', 7, 1.000, 1.000, N'Harina, fécula o pan rallado: compra en bolsas de 1 kg.'),
    (N'Mayonesa', N'Corriente', N'kg', 7, 4.000, 4.000, N'Mayonesa: una caja de 4 kg; conservar tras apertura según la etiqueta.'),
    (N'Salsa', N'Tártara', N'kg', 7, 1.000, 1.000, N'Salsa tártara: compra de 1 kg; seguir instrucciones de conservación tras apertura.'),
    (N'Aceituna', N'Botija', N'kg', 7, 0.500, 0.500, N'Aceitunas: compra redondeada a 500 g.'),
    (N'Aceituna', N'Negra', N'kg', 7, 0.500, 0.500, N'Aceitunas: compra redondeada a 500 g.'),
    (N'Atún', N'Enlatado en filete', N'kg', 7, 0.600, 0.600, N'Atún: kg ESCURRIDOS equivalentes. Paso 0.600 kg = 6 latas con 100 g escurridos supuestos por lata.'),
    (N'Pasta', N'De ají panca', N'kg', 7, 1.000, 1.000, N'Pasta de ají: compra inicial en kg; conservar según fabricante.'),
    (N'Pasta', N'De ají amarillo', N'kg', 7, 1.000, 1.000, N'Pasta de ají: compra inicial en kg; conservar según fabricante.'),
    (N'Vino', N'Blanco de mesa', N'Litro', 7, 0.750, 1.500, N'Vino de cocina: mínimo dos botellas de 750 ml = 1.500 L.'),
    (N'Chicha morada', N'Concentrado', N'Litro', 2, 1.000, 4.000, N'Concentrado de chicha morada: 4 L; verificar rendimiento y conservación del producto.'),
    (N'Chicha de jora', N'Fresca', N'Litro', 2, 1.000, 1.000, N'Chicha de jora fresca: compra para 2 días, según conservación y rotación.'),
    (N'Maracuyá', N'Pulpa congelada', N'kg', 2, 1.000, 3.000, N'Pulpa congelada de maracuyá: 3 kg para bebidas; mantener según etiqueta.'),
    (N'Gaseosa', N'Cola', N'Litro', 2, 3.000, 12.000, N'Gaseosa cola: 12 L equivalentes, por ejemplo cuatro botellas de 3 L.'),
    (N'Gaseosa', N'Amarilla', N'Litro', 2, 3.000, 12.000, N'Gaseosa amarilla: 12 L equivalentes, por ejemplo cuatro botellas de 3 L.'),
    (N'Agua', N'Sin gas', N'Litro', 2, 6.000, 24.000, N'Agua envasada sin gas: 24 L. No representa el agua potable de limpieza ni de cocina.'),
    (N'Hielo', N'En barra', N'kg', 1, 5.000, 30.000, N'Hielo inicial de 30 kg: reserva OPERATIVA para conservación y preparación; no incluye una máquina de hielo.');

DECLARE @consumo_apertura TABLE (
    id_insumo INT NOT NULL PRIMARY KEY,
    consumo_diario_bruto DECIMAL(18,6) NOT NULL
);
DECLARE @plan_inventario TABLE (
    id_insumo INT NOT NULL PRIMARY KEY,
    stock_recomendado DECIMAL(14,3) NOT NULL,
    consumo_diario_bruto DECIMAL(18,6) NOT NULL,
    dias_cobertura SMALLINT NULL,
    observacion NVARCHAR(300) NOT NULL
);

SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;

    IF EXISTS (
        SELECT 1 FROM @menu_apertura m
        WHERE NOT EXISTS (
            SELECT 1 FROM dbo.platos p
            WHERE p.id_instalacion = @instalacion_apertura
              AND p.id_restaurante = @restaurante_apertura
              AND p.id_plato_local = m.id_plato_local
        )
    )
        THROW 50004, N'Faltan platos del catálogo elegido para calcular el stock inicial.', 1;

    IF EXISTS (
        SELECT 1 FROM @politicas_apertura a
        WHERE NOT EXISTS (
            SELECT 1 FROM dbo.insumos i
            JOIN dbo.unidades_medida u ON u.id_unidad = i.id_unidad
            WHERE i.nombre = a.nombre AND i.variedad = a.variedad
              AND u.codigo = a.unidad_base
        )
    )
        THROW 50005, N'No coinciden los insumos/unidades del plan de apertura.', 1;

    -- Pedidos son recetas COMPLETAS. No dividir por porciones: una jalea
    -- vendida utiliza su receta completa y atiende a dos personas.
    INSERT INTO @consumo_apertura (id_insumo, consumo_diario_bruto)
    SELECT d.id_insumo,
           CAST(SUM(d.cantidad_base / (1 - d.merma_pct / 100.0)
                    * m.pedidos_dia_base * @factor_comensales) AS DECIMAL(18,6))
    FROM dbo.receta_detalles d
    JOIN dbo.platos p ON p.id_plato = d.id_plato
    JOIN @menu_apertura m ON m.id_plato_local = p.id_plato_local
    WHERE p.id_instalacion = @instalacion_apertura
      AND p.id_restaurante = @restaurante_apertura
    GROUP BY d.id_insumo;

    -- Detectar también una receta vacía o insumos sin política de compra.
    IF EXISTS (
        SELECT 1 FROM @menu_apertura m
        JOIN dbo.platos p ON p.id_plato_local = m.id_plato_local
                         AND p.id_instalacion = @instalacion_apertura
                         AND p.id_restaurante = @restaurante_apertura
        WHERE NOT EXISTS (SELECT 1 FROM dbo.receta_detalles d WHERE d.id_plato = p.id_plato)
    )
        THROW 50006, N'Hay platos sin receta; no se inicializó el inventario.', 1;

    IF EXISTS (
        SELECT 1 FROM @consumo_apertura c
        JOIN dbo.insumos i ON i.id_insumo = c.id_insumo
        JOIN dbo.unidades_medida u ON u.id_unidad = i.id_unidad
        WHERE NOT EXISTS (
            SELECT 1 FROM @politicas_apertura a
            WHERE a.nombre = i.nombre AND a.variedad = i.variedad
              AND a.unidad_base = u.codigo
        )
    )
        THROW 50007, N'Una receta utiliza insumos sin política de apertura; añadirla antes de ejecutar.', 1;

    INSERT INTO @plan_inventario
        (id_insumo, stock_recomendado, consumo_diario_bruto, dias_cobertura, observacion)
    SELECT i.id_insumo,
           CAST(CASE WHEN a.nombre IS NULL THEN 0
                     ELSE CEILING(
                         CASE WHEN n.necesidad > a.minimo_base * @factor_comensales
                              THEN n.necesidad
                              ELSE a.minimo_base * @factor_comensales END
                         / a.paso_compra) * a.paso_compra END AS DECIMAL(14,3)),
           ISNULL(c.consumo_diario_bruto, 0),
           a.dias_cobertura,
           ISNULL(a.observacion, N'Sin compra programada: insumo fuera del menú de apertura.')
    FROM dbo.insumos i
    JOIN dbo.unidades_medida u ON u.id_unidad = i.id_unidad
    LEFT JOIN @consumo_apertura c ON c.id_insumo = i.id_insumo
    LEFT JOIN @politicas_apertura a ON a.nombre = i.nombre
                                  AND a.variedad = i.variedad
                                  AND a.unidad_base = u.codigo
    CROSS APPLY (
        SELECT ISNULL(c.consumo_diario_bruto, 0) * ISNULL(a.dias_cobertura, 0)
               * (1 + @reserva_demanda_pct / 100.0) AS necesidad
    ) n;

    UPDATE i
    SET i.stock_inicial = p.stock_recomendado
    FROM dbo.insumos i
    JOIN @plan_inventario p ON p.id_insumo = i.id_insumo
    WHERE i.stock_inicial IS NULL;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

-- Comparar el plan calculado con lo guardado; una re-ejecución conserva el
-- stock inicial existente, por eso pueden diferir tras cambiar parámetros.
SELECT i.id_insumo, i.nombre, i.variedad, u.codigo AS unidad_medida,
       p.consumo_diario_bruto, p.dias_cobertura,
       p.stock_recomendado, i.stock_inicial AS stock_inicial_guardado,
       p.observacion
FROM @plan_inventario p
JOIN dbo.insumos i ON i.id_insumo = p.id_insumo
JOIN dbo.unidades_medida u ON u.id_unidad = i.id_unidad
WHERE p.stock_recomendado > 0 OR i.stock_inicial > 0
ORDER BY i.id_insumo;
GO

-- La vista original incorpora la nueva cantidad sin cambiar las columnas previas.
CREATE OR ALTER VIEW dbo.vista_insumos AS
SELECT i.id_insumo, i.codigo_comercial, i.nombre, i.variedad, c.nombre AS categoria,
       u.codigo AS unidad_medida, i.precio_mayorista, i.activo, i.stock_inicial
FROM dbo.insumos i
LEFT JOIN dbo.categorias c ON i.id_categoria = c.id_categoria
LEFT JOIN dbo.unidades_medida u ON i.id_unidad = u.id_unidad;
GO

CREATE OR ALTER VIEW dbo.vista_inventario_apertura AS
SELECT i.id_insumo, i.nombre, i.variedad, c.nombre AS categoria,
       u.codigo AS unidad_medida, i.stock_inicial, i.precio_mayorista,
       CAST(i.stock_inicial * i.precio_mayorista AS DECIMAL(18,2)) AS valor_stock_referencial,
       CASE WHEN i.stock_inicial IS NULL THEN N'PENDIENTE'
            WHEN i.stock_inicial = 0 THEN N'SIN_COMPRA_INICIAL'
            ELSE N'CON_STOCK_INICIAL' END AS estado_apertura,
       i.activo
FROM dbo.insumos i
LEFT JOIN dbo.categorias c ON c.id_categoria = i.id_categoria
JOIN dbo.unidades_medida u ON u.id_unidad = i.id_unidad;
GO

SELECT *
FROM dbo.vista_inventario_apertura
WHERE stock_inicial > 0
ORDER BY id_insumo;

SELECT COUNT(*) AS insumos_con_stock_inicial,
       SUM(valor_stock_referencial) AS presupuesto_materia_prima_referencial
FROM dbo.vista_inventario_apertura
WHERE stock_inicial > 0;
GO

-- ============================================================================
-- 8. PERSONAL Y COSTOS LABORALES - CEVICHERÍA MEDIANA / COSTEA
-- SQL Server 2016 SP1+. Datos personales, contratos, pagos y pólizas SIMULADOS.
-- 13 personas: 8 dependientes completos registrados, 1 parcial registrado,
-- 2 dependientes no registrados y 2 prestadores verdaderamente autónomos.
-- Régimen GENERAL como supuesto explícito: tamaño mediano no acredita REMYPE.
-- Proyección de 12 MESES ESTABLES con condiciones al 13/10/2026; NO reconstruye
-- boletas reales de enero-diciembre 2026. Calendario 2026 solo como referencia.
-- Beneficios se calculan suponiendo año/semestres completos. Altas, bajas,
-- suspensiones, cambios salariales y liquidaciones truncas requieren otro módulo.
-- Variables por feriados/horas extra se promedian anualmente para el costeo,
-- suponiendo regularidad; nómina real exige promedios del semestre y evidencia.
-- Nombres son ficticios; no se inventan DNI, RUC, cuentas ni pólizas reales.
--
-- REGLAS QUE EVITAN DOBLE CONTEO:
-- 1) Vacaciones pagadas están DENTRO de las 12 remuneraciones. Se exhiben como
--    parte informativa del sueldo anual y reducen las horas de trabajo efectivo.
--    Reemplazo de vacaciones es un costo ADICIONAL separado, aquí supuesto 0.
-- 2) Asignación familiar se paga una sola vez por trabajador elegible (10% RMV),
--    no por hijo. Incluye acreditación, menores o superiores hasta 24 años.
-- 3) Escolaridad es ayuda VOLUNTARIA simulada por hijo elegible, no universal.
-- 4) Bolsa mensual de víveres de libre disposición se trata REMUNERATIVA y se
--    integra a gratificaciones, CTS, EsSalud y pensión. No sumarla otra vez.
-- 5) Movilidad razonable contra asistencia y alimentación indispensable para
--    el trabajo se suponen CONDICIÓN DE TRABAJO. Si son dinero libre/remuneración,
--    cambiar clasificación/base: no basta renombrar un pago para excluir aportes.
-- 6) Gratificaciones legales no llevan aporte EsSalud/ONP/AFP; sí se añade la
--    bonificación extraordinaria y se evalúa quinta categoría en la proyección.
-- 7) AFP/ONP y retenciones IR son DESCUENTOS del trabajador, no otro costo patronal.
-- 8) CTS general anual = remuneración computable + 1/6 de una gratificación,
--    para jornada promedio >=4 h. Tiempo parcial: gratificaciones sí, CTS no,
--    y 6 días laborables de vacaciones, sin borrar EsSalud ni Vida Ley.
-- 9) SCTR Salud y Pensión separados; actividad de restaurantes CIIU 5610.
--    Primas individuales estimadas, no tasas legales ni cotizaciones emitidas.
--    Accidente adicional es póliza VOLUNTARIA distinta, no sustituto del SCTR.
-- 10) Dos dependientes sin registro mantienen derechos calculados. Se compara
--    costo completo con desembolso SIMULADO; brecha no es deuda legal exacta.
-- 11) Autónomos: honorarios, sin subordinación; sus horas son un estimador de
--    servicio, no horario laboral impuesto. Cocina/mozos no se disfrazan de RH.
-- 12) Feriados del sector privado: 16 fechas, sin días no laborables públicos.
--    Se trabaja martes-domingo, descanso lunes; cuenta real de coincidencias
--    con vacaciones/feriados sin descontar dos veces el mismo día.
--    Personal operativo trabaja feriados sin descanso sustitutorio: dos pagos
--    diarios ADICIONALES. Administradora descansa feriados.
-- 13) Utilidades campo explícito 0: escenario 11 dependientes, bajo umbral >20.
--    Quinta mensual aquí = estimación anual/12, NO retención PLAME definitiva.
--    Cuarta supone un RH/mes y empresa agente de retención; si no lo fuera,
--    adaptar retención. Comisión AFP saldo no se descuenta otra vez del sueldo.
-- 14) Costo por hora no se asigna automáticamente a platos: falta medir minutos
--    de trabajo por receta. Clasificación MOD/CIF/ADMIN/VENTAS queda disponible.
-- Re-ejecutable: datos simulados se insertan solo si su clave no existe.
-- Las vistas recalculan al editar tarifas, hijos, beneficios, horarios y pólizas.
-- =============================================================================
-- FUENTE: RMV de octubre de 2026, D.S. 015-2026-TR
-- https://busquedas.elperuano.pe/dispositivo/EX/2559163-1
-- FUENTE: Asignación familiar: requisitos
-- https://www.gob.pe/institucion/mtpe/noticias/601761-quienes-tienen-derecho-a-percibir-la-asignacion-familiar
-- FUENTE: Vacaciones: 30 días y 6 días para tiempo parcial
-- https://www.gob.pe/institucion/sunafil/noticias/1092181-cuando-te-corresponden-vacaciones-todo-lo-que-necesitas-saber-para-planificar-tu-descanso
-- FUENTE: CTS: mínimo 4 horas promedio
-- https://www.gob.pe/institucion/mtpe/noticias/1383535-mtpe-trabajadores-del-regimen-privado-que-laboren-4-horas-diarias-en-promedio-tienen-derecho-a-cts
-- FUENTE: CTS: incluir un sexto de gratificación
-- https://elperuano.pe/noticia/294575-recibiras-cts-en-mayo-conoce-los-requisitos-de-jornada-minima-y-que-trabajadores-quedan-excluidos-del-pago
-- FUENTE: Bonificación de gratificación 9%/6.75%
-- https://www.gob.pe/institucion/sunafil/noticias/986315-el-pago-por-horas-extras-ingresa-dentro-del-calculo-para-la-gratificacion-de-julio
-- FUENTE: Base EsSalud y conceptos afectos
-- https://orientacion.sunat.gob.pe/05-base-imponible-y-conceptos-afectos-aporte-essalud
-- FUENTE: EsSalud 9% y base mínima
-- https://www.gob.pe/218-seguro-regular-essalud-seguro-aportes
-- FUENTE: Crédito EPS: límites
-- https://www.sunat.gob.pe/legislacion/oficios/2004/oficios/i0882004.htm
-- FUENTE: Vida Ley desde inicio
-- https://www.sbs.gob.pe/usuarios/aprende-con-la-sbs/seguro-vida-ley
-- FUENTE: SCTR obligatorio en actividad de restaurantes
-- https://www.gob.pe/institucion/onp/noticias/1064619-restaurantes-veterinarias-y-seguridad-privada-conoce-las-270-actividades-que-deben-contratar-el-sctr-pension
-- FUENTE: SCTR: coberturas Salud y Pensión, D.S. 008-2022-SA
-- https://busquedas.elperuano.pe/dispositivo/NL/2073930-1
-- FUENTE: ONP 13%
-- https://orientacion.sunat.gob.pe/08-tasa-y-calculo-del-aporte-al-snp-onp
-- FUENTE: AFP Profuturo, tasas octubre de 2026
-- https://enlinea.profuturo.com.pe/zonaprivadaext/aportes_primas
-- FUENTE: UIT 2026 S/5500
-- https://www.gob.pe/institucion/mef/noticias/1314665-mef-establece-en-s-5500-el-valor-de-la-uit-para-el-ano-2026
-- FUENTE: Quinta categoría: deducción y escala
-- https://personas.sunat.gob.pe/trabajador-dependiente/declaracion-pago
-- FUENTE: Cuarta categoría: 8%, recibo hasta S/1500
-- https://personas.sunat.gob.pe/trabajador-independiente/declaracion-pago
-- FUENTE: Dependencia frente a locación autónoma
-- https://www.gob.pe/institucion/sunafil/noticias/594915-cual-es-la-diferencia-entre-un-contrato-de-trabajo-y-un-contrato-de-locacion-de-servicios
-- FUENTE: Feriados trabajados: dos pagos adicionales
-- https://www.gob.pe/institucion/sunafil/noticias/1372667-trabajaras-este-jueves-y-viernes-santo-conoce-si-te-corresponde-un-pago-adicional
-- FUENTE: Feriados 2026
-- https://www.gob.pe/feriados
-- FUENTE: Feriados históricos 2026
-- https://www.gob.pe/feriados/historicos
-- FUENTE: Utilidades: más de 20 trabajadores, restaurantes 8%
-- https://www.gob.pe/1044-ministerio-de-trabajo-y-promocion-del-empleo-que-son-las-
-- FUENTE: Escolaridad pública 2026: no confundir con obligación general privada
-- https://busquedas.elperuano.pe/dispositivo/NL/2477092-1

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
GO

IF OBJECT_ID(N'dbo.parametros_laborales', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.parametros_laborales (
id_escenario INT PRIMARY KEY,
 nombre NVARCHAR(150) NOT NULL,
 id_instalacion NVARCHAR(36) NOT NULL,
 id_restaurante INT NOT NULL,
 fecha_referencia DATE NOT NULL,
 anio_calendario INT NOT NULL,
 regimen NVARCHAR(30) NOT NULL CHECK (regimen = N'GENERAL'),
 rmv DECIMAL(12,2) NOT NULL CHECK (rmv > 0),
 uit DECIMAL(12,2) NOT NULL CHECK (uit > 0),
 tasa_asignacion DECIMAL(7,4) NOT NULL,
 tasa_essalud DECIMAL(7,4) NOT NULL,
 tasa_bonificacion_grati_essalud DECIMAL(7,4) NOT NULL,
 tasa_bonificacion_grati_eps DECIMAL(7,4) NOT NULL,
 tasa_credito_eps DECIMAL(7,4) NOT NULL,
 tasa_onp DECIMAL(7,4) NOT NULL,
 tasa_afp_aporte DECIMAL(7,4) NOT NULL,
 tasa_afp_prima DECIMAL(7,4) NOT NULL,
 tasa_afp_flujo DECIMAL(7,4) NOT NULL,
 afp_referencia NVARCHAR(40) NOT NULL,
 tope_prima_afp DECIMAL(12,2) NOT NULL,
 tasa_cuarta DECIMAL(7,4) NOT NULL,
 limite_recibo_sin_retencion DECIMAL(12,2) NOT NULL,
 dias_semana_empresa TINYINT NOT NULL CHECK (dias_semana_empresa IN (5,6)),
 observaciones NVARCHAR(1000) NOT NULL
    );
END;
GO

IF OBJECT_ID(N'dbo.areas_personal', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.areas_personal (
codigo_area NVARCHAR(20) PRIMARY KEY,
 nombre NVARCHAR(80) NOT NULL,
 clasificacion_costo NVARCHAR(30) NOT NULL CHECK (clasificacion_costo IN (N'MOD',N'CIF',N'ADMINISTRACION',N'VENTAS'))
    );
END;
GO

IF OBJECT_ID(N'dbo.trabajadores', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.trabajadores (
codigo_trabajador NVARCHAR(20) PRIMARY KEY,
 nombres NVARCHAR(100) NOT NULL,
 apellidos NVARCHAR(100) NOT NULL,
 cargo NVARCHAR(100) NOT NULL,
 codigo_area NVARCHAR(20) NOT NULL REFERENCES dbo.areas_personal(codigo_area),
 es_simulado BIT NOT NULL DEFAULT 1,
 activo BIT NOT NULL DEFAULT 1
    );
END;
GO

IF OBJECT_ID(N'dbo.contratos_personal', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.contratos_personal (
codigo_contrato NVARCHAR(20) PRIMARY KEY,
 codigo_trabajador NVARCHAR(20) NOT NULL REFERENCES dbo.trabajadores(codigo_trabajador),
 id_escenario INT NOT NULL REFERENCES dbo.parametros_laborales(id_escenario),
 vinculo NVARCHAR(20) NOT NULL CHECK (vinculo IN (N'DEPENDIENTE',N'INDEPENDIENTE')),
 estado_planilla NVARCHAR(25) NOT NULL CHECK (estado_planilla IN (N'REGISTRADO',N'NO_REGISTRADO',N'NO_APLICA')),
 modalidad NVARCHAR(40) NOT NULL,
 fecha_inicio DATE NOT NULL,
 tipo_pago NVARCHAR(20) NOT NULL CHECK (tipo_pago IN (N'MENSUAL',N'HORA',N'SERVICIO')),
 tarifa DECIMAL(12,2) NOT NULL CHECK (tarifa > 0),
 horas_dia DECIMAL(6,2) NOT NULL CHECK (horas_dia >= 0 AND horas_dia <= 8),
 dias_semana TINYINT NOT NULL CHECK (dias_semana BETWEEN 0 AND 6),
 horas_servicio_mes DECIMAL(8,2) NOT NULL CHECK (horas_servicio_mes >= 0),
 factor_productivo DECIMAL(6,4) NOT NULL CHECK (factor_productivo > 0 AND factor_productivo <= 1),
 trabaja_feriados BIT NOT NULL,
 pension NVARCHAR(20) NOT NULL CHECK (pension IN (N'ONP',N'AFP_FLUJO',N'AFP_SALDO',N'NO_APLICA')),
 salud NVARCHAR(20) NOT NULL CHECK (salud IN (N'ESSALUD',N'EPS',N'NO_APLICA')),
 tiene_suspension_cuarta BIT NOT NULL DEFAULT 0,
 activo BIT NOT NULL DEFAULT 1,
 observaciones NVARCHAR(800) NOT NULL,
 CONSTRAINT CK_contrato_vinculo_planilla CHECK (
   (vinculo = N'DEPENDIENTE' AND estado_planilla IN (N'REGISTRADO',N'NO_REGISTRADO') AND salud <> N'NO_APLICA' AND pension <> N'NO_APLICA' AND horas_dia > 0 AND dias_semana > 0)
   OR (vinculo = N'INDEPENDIENTE' AND estado_planilla = N'NO_APLICA' AND salud = N'NO_APLICA' AND pension = N'NO_APLICA' AND horas_servicio_mes > 0))
    );
END;
GO

IF OBJECT_ID(N'dbo.hijos_personal', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.hijos_personal (
codigo_hijo NVARCHAR(20) PRIMARY KEY,
 codigo_trabajador NVARCHAR(20) NOT NULL REFERENCES dbo.trabajadores(codigo_trabajador),
 edad_al_corte TINYINT NOT NULL CHECK (edad_al_corte BETWEEN 0 AND 100),
 cursa_superiores BIT NOT NULL,
 acreditado BIT NOT NULL,
 escolaridad_simulada BIT NOT NULL,
 observacion NVARCHAR(300) NOT NULL
    );
END;
GO

IF OBJECT_ID(N'dbo.beneficios_personal', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.beneficios_personal (
codigo_contrato NVARCHAR(20) PRIMARY KEY REFERENCES dbo.contratos_personal(codigo_contrato),
 bono_remunerativo_mes DECIMAL(12,2) NOT NULL CHECK (bono_remunerativo_mes >= 0),
 bolsa_viveres_mes DECIMAL(12,2) NOT NULL CHECK (bolsa_viveres_mes >= 0),
 movilidad_condicion_mes DECIMAL(12,2) NOT NULL CHECK (movilidad_condicion_mes >= 0),
 alimentacion_condicion_mes DECIMAL(12,2) NOT NULL CHECK (alimentacion_condicion_mes >= 0),
 escolaridad_por_hijo_anual DECIMAL(12,2) NOT NULL CHECK (escolaridad_por_hijo_anual >= 0),
 canasta_navidad_anual DECIMAL(12,2) NOT NULL CHECK (canasta_navidad_anual >= 0),
 uniformes_epp_anual DECIMAL(12,2) NOT NULL CHECK (uniformes_epp_anual >= 0),
 examenes_capacitacion_anual DECIMAL(12,2) NOT NULL CHECK (examenes_capacitacion_anual >= 0),
 eps_empresa_mes DECIMAL(12,2) NOT NULL CHECK (eps_empresa_mes >= 0),
 vida_ley_mes_estimada DECIMAL(12,2) NOT NULL CHECK (vida_ley_mes_estimada >= 0),
 sctr_salud_mes_estimada DECIMAL(12,2) NOT NULL CHECK (sctr_salud_mes_estimada >= 0),
 sctr_pension_mes_estimada DECIMAL(12,2) NOT NULL CHECK (sctr_pension_mes_estimada >= 0),
 accidente_adicional_mes DECIMAL(12,2) NOT NULL CHECK (accidente_adicional_mes >= 0),
 horas_extra_25_mes DECIMAL(8,2) NOT NULL CHECK (horas_extra_25_mes >= 0),
 horas_extra_35_mes DECIMAL(8,2) NOT NULL CHECK (horas_extra_35_mes >= 0),
 utilidades_anual DECIMAL(12,2) NOT NULL CHECK (utilidades_anual >= 0),
 reemplazo_vacaciones_anual DECIMAL(12,2) NOT NULL CHECK (reemplazo_vacaciones_anual >= 0),
 observaciones NVARCHAR(1000) NOT NULL
    );
END;
GO

IF OBJECT_ID(N'dbo.jornadas_personal', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.jornadas_personal (
codigo_contrato NVARCHAR(20) NOT NULL REFERENCES dbo.contratos_personal(codigo_contrato),
 dia_iso TINYINT NOT NULL CHECK (dia_iso BETWEEN 1 AND 7),
 PRIMARY KEY (codigo_contrato, dia_iso)
    );
END;
GO

IF OBJECT_ID(N'dbo.calendario_laboral', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.calendario_laboral (
fecha DATE PRIMARY KEY,
 anio INT NOT NULL,
 dia_iso TINYINT NOT NULL CHECK (dia_iso BETWEEN 1 AND 7),
 es_feriado BIT NOT NULL,
 descripcion NVARCHAR(100) NOT NULL
    );
END;
GO

IF OBJECT_ID(N'dbo.vacaciones_personal', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.vacaciones_personal (
codigo_contrato NVARCHAR(20) NOT NULL REFERENCES dbo.contratos_personal(codigo_contrato),
 anio INT NOT NULL,
 fecha_inicio DATE NOT NULL,
 fecha_fin DATE NOT NULL,
 tipo_dias NVARCHAR(20) NOT NULL CHECK (tipo_dias IN (N'CALENDARIO',N'LABORABLES')),
 observacion NVARCHAR(500) NOT NULL,
 PRIMARY KEY (codigo_contrato, anio),
 CHECK (fecha_fin >= fecha_inicio)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.contratos_personal') AND name = N'UQ_contrato_personal_activo')
    CREATE UNIQUE INDEX UQ_contrato_personal_activo ON dbo.contratos_personal(codigo_trabajador) WHERE activo = 1;
GO
BEGIN TRY
 BEGIN TRANSACTION;
 IF NOT EXISTS (SELECT 1 FROM dbo.parametros_laborales WHERE id_escenario = 1)
  INSERT INTO dbo.parametros_laborales (id_escenario, nombre, id_instalacion, id_restaurante, fecha_referencia, anio_calendario, regimen, rmv, uit, tasa_asignacion, tasa_essalud, tasa_bonificacion_grati_essalud, tasa_bonificacion_grati_eps, tasa_credito_eps, tasa_onp, tasa_afp_aporte, tasa_afp_prima, tasa_afp_flujo, afp_referencia, tope_prima_afp, tasa_cuarta, limite_recibo_sin_retencion, dias_semana_empresa, observaciones) VALUES (1, N'Cevichería mediana: proyección anual normalizada', N'CATALOGO-BASE', 0, N'2026-10-13', 2026, N'GENERAL', 1230, 5500, 10, 9, 9, 6.75, 25, 13, 10, 1.37, 1.69, N'PROFUTURO', 12732.7, 8, 1500, 6, N'Proyección de 12 meses con valores de octubre de 2026 y calendario de referencia 2026. No es liquidación real del año 2026 ni historial de boletas. RMV de enero-septiembre de 2026 fue 1130; aquí se congela 1230 para el escenario. No se presume inscripción REMYPE.');
 IF NOT EXISTS (SELECT 1 FROM dbo.areas_personal WHERE codigo_area = N'COCINA')
  INSERT INTO dbo.areas_personal (codigo_area, nombre, clasificacion_costo) VALUES (N'COCINA', N'Producción de platos', N'MOD');
 IF NOT EXISTS (SELECT 1 FROM dbo.areas_personal WHERE codigo_area = N'SALON')
  INSERT INTO dbo.areas_personal (codigo_area, nombre, clasificacion_costo) VALUES (N'SALON', N'Atención al cliente', N'VENTAS');
 IF NOT EXISTS (SELECT 1 FROM dbo.areas_personal WHERE codigo_area = N'ADMIN')
  INSERT INTO dbo.areas_personal (codigo_area, nombre, clasificacion_costo) VALUES (N'ADMIN', N'Administración y caja', N'ADMINISTRACION');
 IF NOT EXISTS (SELECT 1 FROM dbo.areas_personal WHERE codigo_area = N'SOPORTE')
  INSERT INTO dbo.areas_personal (codigo_area, nombre, clasificacion_costo) VALUES (N'SOPORTE', N'Limpieza y mantenimiento', N'CIF');
 IF NOT EXISTS (SELECT 1 FROM dbo.trabajadores WHERE codigo_trabajador = N'SIM001')
  INSERT INTO dbo.trabajadores (codigo_trabajador, nombres, apellidos, cargo, codigo_area, es_simulado, activo) VALUES (N'SIM001', N'Lucía', N'Ramos Paredes', N'Administradora', N'ADMIN', 1, 1);
 IF NOT EXISTS (SELECT 1 FROM dbo.trabajadores WHERE codigo_trabajador = N'SIM002')
  INSERT INTO dbo.trabajadores (codigo_trabajador, nombres, apellidos, cargo, codigo_area, es_simulado, activo) VALUES (N'SIM002', N'Miguel', N'Torres Salazar', N'Jefe de cocina y cevichero', N'COCINA', 1, 1);
 IF NOT EXISTS (SELECT 1 FROM dbo.trabajadores WHERE codigo_trabajador = N'SIM003')
  INSERT INTO dbo.trabajadores (codigo_trabajador, nombres, apellidos, cargo, codigo_area, es_simulado, activo) VALUES (N'SIM003', N'Renato', N'Vargas León', N'Cocinero de platos calientes', N'COCINA', 1, 1);
 IF NOT EXISTS (SELECT 1 FROM dbo.trabajadores WHERE codigo_trabajador = N'SIM004')
  INSERT INTO dbo.trabajadores (codigo_trabajador, nombres, apellidos, cargo, codigo_area, es_simulado, activo) VALUES (N'SIM004', N'Ana', N'Flores Medina', N'Ayudante de cocina', N'COCINA', 1, 1);
 IF NOT EXISTS (SELECT 1 FROM dbo.trabajadores WHERE codigo_trabajador = N'SIM005')
  INSERT INTO dbo.trabajadores (codigo_trabajador, nombres, apellidos, cargo, codigo_area, es_simulado, activo) VALUES (N'SIM005', N'Carlos', N'Quispe Rojas', N'Mozo principal', N'SALON', 1, 1);
 IF NOT EXISTS (SELECT 1 FROM dbo.trabajadores WHERE codigo_trabajador = N'SIM006')
  INSERT INTO dbo.trabajadores (codigo_trabajador, nombres, apellidos, cargo, codigo_area, es_simulado, activo) VALUES (N'SIM006', N'Daniela', N'Soto Palomino', N'Moza', N'SALON', 1, 1);
 IF NOT EXISTS (SELECT 1 FROM dbo.trabajadores WHERE codigo_trabajador = N'SIM007')
  INSERT INTO dbo.trabajadores (codigo_trabajador, nombres, apellidos, cargo, codigo_area, es_simulado, activo) VALUES (N'SIM007', N'Patricia', N'Castro Díaz', N'Cajera', N'ADMIN', 1, 1);
 IF NOT EXISTS (SELECT 1 FROM dbo.trabajadores WHERE codigo_trabajador = N'SIM008')
  INSERT INTO dbo.trabajadores (codigo_trabajador, nombres, apellidos, cargo, codigo_area, es_simulado, activo) VALUES (N'SIM008', N'José', N'Huamán Vega', N'Lavado y limpieza', N'SOPORTE', 1, 1);
 IF NOT EXISTS (SELECT 1 FROM dbo.trabajadores WHERE codigo_trabajador = N'SIM009')
  INSERT INTO dbo.trabajadores (codigo_trabajador, nombres, apellidos, cargo, codigo_area, es_simulado, activo) VALUES (N'SIM009', N'Diego', N'Mendoza Ruiz', N'Mozo de refuerzo por horas', N'SALON', 1, 1);
 IF NOT EXISTS (SELECT 1 FROM dbo.trabajadores WHERE codigo_trabajador = N'SIM010')
  INSERT INTO dbo.trabajadores (codigo_trabajador, nombres, apellidos, cargo, codigo_area, es_simulado, activo) VALUES (N'SIM010', N'Valeria', N'Chávez López', N'Ayudante de cocina no registrada', N'COCINA', 1, 1);
 IF NOT EXISTS (SELECT 1 FROM dbo.trabajadores WHERE codigo_trabajador = N'SIM011')
  INSERT INTO dbo.trabajadores (codigo_trabajador, nombres, apellidos, cargo, codigo_area, es_simulado, activo) VALUES (N'SIM011', N'Luis', N'Pérez Aguilar', N'Mozo no registrado', N'SALON', 1, 1);
 IF NOT EXISTS (SELECT 1 FROM dbo.trabajadores WHERE codigo_trabajador = N'SIM012')
  INSERT INTO dbo.trabajadores (codigo_trabajador, nombres, apellidos, cargo, codigo_area, es_simulado, activo) VALUES (N'SIM012', N'Roberto', N'García Campos', N'Técnico autónomo de mantenimiento', N'SOPORTE', 1, 1);
 IF NOT EXISTS (SELECT 1 FROM dbo.trabajadores WHERE codigo_trabajador = N'SIM013')
  INSERT INTO dbo.trabajadores (codigo_trabajador, nombres, apellidos, cargo, codigo_area, es_simulado, activo) VALUES (N'SIM013', N'Elena', N'Navarro Silva', N'Contadora externa autónoma', N'ADMIN', 1, 1);
 IF NOT EXISTS (SELECT 1 FROM dbo.contratos_personal WHERE codigo_contrato = N'CT001')
  INSERT INTO dbo.contratos_personal (codigo_contrato, codigo_trabajador, id_escenario, vinculo, estado_planilla, modalidad, fecha_inicio, tipo_pago, tarifa, horas_dia, dias_semana, horas_servicio_mes, factor_productivo, trabaja_feriados, pension, salud, tiene_suspension_cuarta, activo, observaciones) VALUES (N'CT001', N'SIM001', 1, N'DEPENDIENTE', N'REGISTRADO', N'INDEFINIDO', N'2025-01-01', N'MENSUAL', 2600, 8, 6, 0, 0.9, 0, N'AFP_FLUJO', N'EPS', 0, 1, N'Contrato dependiente del régimen general; proyección estable de 12 meses.');
 IF NOT EXISTS (SELECT 1 FROM dbo.contratos_personal WHERE codigo_contrato = N'CT002')
  INSERT INTO dbo.contratos_personal (codigo_contrato, codigo_trabajador, id_escenario, vinculo, estado_planilla, modalidad, fecha_inicio, tipo_pago, tarifa, horas_dia, dias_semana, horas_servicio_mes, factor_productivo, trabaja_feriados, pension, salud, tiene_suspension_cuarta, activo, observaciones) VALUES (N'CT002', N'SIM002', 1, N'DEPENDIENTE', N'REGISTRADO', N'INDEFINIDO', N'2025-01-01', N'MENSUAL', 3000, 8, 6, 0, 0.9, 1, N'AFP_SALDO', N'ESSALUD', 0, 1, N'Contrato dependiente del régimen general; proyección estable de 12 meses.');
 IF NOT EXISTS (SELECT 1 FROM dbo.contratos_personal WHERE codigo_contrato = N'CT003')
  INSERT INTO dbo.contratos_personal (codigo_contrato, codigo_trabajador, id_escenario, vinculo, estado_planilla, modalidad, fecha_inicio, tipo_pago, tarifa, horas_dia, dias_semana, horas_servicio_mes, factor_productivo, trabaja_feriados, pension, salud, tiene_suspension_cuarta, activo, observaciones) VALUES (N'CT003', N'SIM003', 1, N'DEPENDIENTE', N'REGISTRADO', N'INDEFINIDO', N'2025-01-01', N'MENSUAL', 2200, 8, 6, 0, 0.9, 1, N'ONP', N'ESSALUD', 0, 1, N'Contrato dependiente del régimen general; proyección estable de 12 meses.');
 IF NOT EXISTS (SELECT 1 FROM dbo.contratos_personal WHERE codigo_contrato = N'CT004')
  INSERT INTO dbo.contratos_personal (codigo_contrato, codigo_trabajador, id_escenario, vinculo, estado_planilla, modalidad, fecha_inicio, tipo_pago, tarifa, horas_dia, dias_semana, horas_servicio_mes, factor_productivo, trabaja_feriados, pension, salud, tiene_suspension_cuarta, activo, observaciones) VALUES (N'CT004', N'SIM004', 1, N'DEPENDIENTE', N'REGISTRADO', N'INDEFINIDO', N'2025-01-01', N'MENSUAL', 1700, 8, 6, 0, 0.9, 1, N'ONP', N'ESSALUD', 0, 1, N'Contrato dependiente del régimen general; proyección estable de 12 meses.');
 IF NOT EXISTS (SELECT 1 FROM dbo.contratos_personal WHERE codigo_contrato = N'CT005')
  INSERT INTO dbo.contratos_personal (codigo_contrato, codigo_trabajador, id_escenario, vinculo, estado_planilla, modalidad, fecha_inicio, tipo_pago, tarifa, horas_dia, dias_semana, horas_servicio_mes, factor_productivo, trabaja_feriados, pension, salud, tiene_suspension_cuarta, activo, observaciones) VALUES (N'CT005', N'SIM005', 1, N'DEPENDIENTE', N'REGISTRADO', N'INDEFINIDO', N'2025-01-01', N'MENSUAL', 1500, 8, 6, 0, 0.9, 1, N'AFP_SALDO', N'ESSALUD', 0, 1, N'Contrato dependiente del régimen general; proyección estable de 12 meses.');
 IF NOT EXISTS (SELECT 1 FROM dbo.contratos_personal WHERE codigo_contrato = N'CT006')
  INSERT INTO dbo.contratos_personal (codigo_contrato, codigo_trabajador, id_escenario, vinculo, estado_planilla, modalidad, fecha_inicio, tipo_pago, tarifa, horas_dia, dias_semana, horas_servicio_mes, factor_productivo, trabaja_feriados, pension, salud, tiene_suspension_cuarta, activo, observaciones) VALUES (N'CT006', N'SIM006', 1, N'DEPENDIENTE', N'REGISTRADO', N'INDEFINIDO', N'2025-01-01', N'MENSUAL', 1450, 8, 6, 0, 0.9, 1, N'ONP', N'ESSALUD', 0, 1, N'Contrato dependiente del régimen general; proyección estable de 12 meses.');
 IF NOT EXISTS (SELECT 1 FROM dbo.contratos_personal WHERE codigo_contrato = N'CT007')
  INSERT INTO dbo.contratos_personal (codigo_contrato, codigo_trabajador, id_escenario, vinculo, estado_planilla, modalidad, fecha_inicio, tipo_pago, tarifa, horas_dia, dias_semana, horas_servicio_mes, factor_productivo, trabaja_feriados, pension, salud, tiene_suspension_cuarta, activo, observaciones) VALUES (N'CT007', N'SIM007', 1, N'DEPENDIENTE', N'REGISTRADO', N'INDEFINIDO', N'2025-01-01', N'MENSUAL', 1750, 8, 6, 0, 0.9, 1, N'AFP_FLUJO', N'ESSALUD', 0, 1, N'Contrato dependiente del régimen general; proyección estable de 12 meses.');
 IF NOT EXISTS (SELECT 1 FROM dbo.contratos_personal WHERE codigo_contrato = N'CT008')
  INSERT INTO dbo.contratos_personal (codigo_contrato, codigo_trabajador, id_escenario, vinculo, estado_planilla, modalidad, fecha_inicio, tipo_pago, tarifa, horas_dia, dias_semana, horas_servicio_mes, factor_productivo, trabaja_feriados, pension, salud, tiene_suspension_cuarta, activo, observaciones) VALUES (N'CT008', N'SIM008', 1, N'DEPENDIENTE', N'REGISTRADO', N'INDEFINIDO', N'2025-01-01', N'MENSUAL', 1300, 8, 6, 0, 0.9, 1, N'ONP', N'ESSALUD', 0, 1, N'Contrato dependiente del régimen general; proyección estable de 12 meses.');
 IF NOT EXISTS (SELECT 1 FROM dbo.contratos_personal WHERE codigo_contrato = N'CT009')
  INSERT INTO dbo.contratos_personal (codigo_contrato, codigo_trabajador, id_escenario, vinculo, estado_planilla, modalidad, fecha_inicio, tipo_pago, tarifa, horas_dia, dias_semana, horas_servicio_mes, factor_productivo, trabaja_feriados, pension, salud, tiene_suspension_cuarta, activo, observaciones) VALUES (N'CT009', N'SIM009', 1, N'DEPENDIENTE', N'REGISTRADO', N'TIEMPO_PARCIAL', N'2025-01-01', N'HORA', 8, 3, 6, 0, 0.9, 1, N'ONP', N'ESSALUD', 0, 1, N'Jornada 3 h/día y 18 h/semana. Pago por hora y beneficios del régimen general a tiempo parcial.');
 IF NOT EXISTS (SELECT 1 FROM dbo.contratos_personal WHERE codigo_contrato = N'CT010')
  INSERT INTO dbo.contratos_personal (codigo_contrato, codigo_trabajador, id_escenario, vinculo, estado_planilla, modalidad, fecha_inicio, tipo_pago, tarifa, horas_dia, dias_semana, horas_servicio_mes, factor_productivo, trabaja_feriados, pension, salud, tiene_suspension_cuarta, activo, observaciones) VALUES (N'CT010', N'SIM010', 1, N'DEPENDIENTE', N'NO_REGISTRADO', N'SIN_REGISTRO_SIMULADO', N'2025-01-01', N'MENSUAL', 1650, 8, 6, 0, 0.9, 1, N'ONP', N'ESSALUD', 0, 1, N'Caso ficticio de dependencia no registrada: se calculan derechos como dependiente; la omisión NO suprime beneficios.');
 IF NOT EXISTS (SELECT 1 FROM dbo.contratos_personal WHERE codigo_contrato = N'CT011')
  INSERT INTO dbo.contratos_personal (codigo_contrato, codigo_trabajador, id_escenario, vinculo, estado_planilla, modalidad, fecha_inicio, tipo_pago, tarifa, horas_dia, dias_semana, horas_servicio_mes, factor_productivo, trabaja_feriados, pension, salud, tiene_suspension_cuarta, activo, observaciones) VALUES (N'CT011', N'SIM011', 1, N'DEPENDIENTE', N'NO_REGISTRADO', N'SIN_REGISTRO_SIMULADO', N'2025-01-01', N'MENSUAL', 1350, 8, 6, 0, 0.9, 1, N'ONP', N'ESSALUD', 0, 1, N'Caso ficticio de dependencia no registrada: se calculan derechos como dependiente; la omisión NO suprime beneficios.');
 IF NOT EXISTS (SELECT 1 FROM dbo.contratos_personal WHERE codigo_contrato = N'CT012')
  INSERT INTO dbo.contratos_personal (codigo_contrato, codigo_trabajador, id_escenario, vinculo, estado_planilla, modalidad, fecha_inicio, tipo_pago, tarifa, horas_dia, dias_semana, horas_servicio_mes, factor_productivo, trabaja_feriados, pension, salud, tiene_suspension_cuarta, activo, observaciones) VALUES (N'CT012', N'SIM012', 1, N'INDEPENDIENTE', N'NO_APLICA', N'LOCACION_AUTONOMA', N'2025-01-01', N'HORA', 45, 0, 0, 6, 1, 0, N'NO_APLICA', N'NO_APLICA', 0, 1, N'Servicio autónomo por resultado, sin jefe ni horario subordinado. Horas solo para presupuestar.');
 IF NOT EXISTS (SELECT 1 FROM dbo.contratos_personal WHERE codigo_contrato = N'CT013')
  INSERT INTO dbo.contratos_personal (codigo_contrato, codigo_trabajador, id_escenario, vinculo, estado_planilla, modalidad, fecha_inicio, tipo_pago, tarifa, horas_dia, dias_semana, horas_servicio_mes, factor_productivo, trabaja_feriados, pension, salud, tiene_suspension_cuarta, activo, observaciones) VALUES (N'CT013', N'SIM013', 1, N'INDEPENDIENTE', N'NO_APLICA', N'LOCACION_AUTONOMA', N'2025-01-01', N'SERVICIO', 550, 0, 0, 8, 1, 0, N'NO_APLICA', N'NO_APLICA', 0, 1, N'Servicio autónomo por resultado, sin jefe ni horario subordinado. Horas solo para presupuestar.');
 IF NOT EXISTS (SELECT 1 FROM dbo.hijos_personal WHERE codigo_hijo = N'H001')
  INSERT INTO dbo.hijos_personal (codigo_hijo, codigo_trabajador, edad_al_corte, cursa_superiores, acreditado, escolaridad_simulada, observacion) VALUES (N'H001', N'SIM001', 9, 0, 1, 1, N'Menor en educación básica; dato ficticio.');
 IF NOT EXISTS (SELECT 1 FROM dbo.hijos_personal WHERE codigo_hijo = N'H002')
  INSERT INTO dbo.hijos_personal (codigo_hijo, codigo_trabajador, edad_al_corte, cursa_superiores, acreditado, escolaridad_simulada, observacion) VALUES (N'H002', N'SIM002', 12, 0, 1, 1, N'Menor en educación básica; dato ficticio.');
 IF NOT EXISTS (SELECT 1 FROM dbo.hijos_personal WHERE codigo_hijo = N'H003')
  INSERT INTO dbo.hijos_personal (codigo_hijo, codigo_trabajador, edad_al_corte, cursa_superiores, acreditado, escolaridad_simulada, observacion) VALUES (N'H003', N'SIM002', 7, 0, 1, 1, N'Menor en educación básica; dato ficticio.');
 IF NOT EXISTS (SELECT 1 FROM dbo.hijos_personal WHERE codigo_hijo = N'H004')
  INSERT INTO dbo.hijos_personal (codigo_hijo, codigo_trabajador, edad_al_corte, cursa_superiores, acreditado, escolaridad_simulada, observacion) VALUES (N'H004', N'SIM004', 6, 0, 1, 1, N'Menor en educación básica; dato ficticio.');
 IF NOT EXISTS (SELECT 1 FROM dbo.hijos_personal WHERE codigo_hijo = N'H005')
  INSERT INTO dbo.hijos_personal (codigo_hijo, codigo_trabajador, edad_al_corte, cursa_superiores, acreditado, escolaridad_simulada, observacion) VALUES (N'H005', N'SIM005', 21, 1, 1, 0, N'Estudios superiores acreditados; habilita asignación familiar, no escolaridad voluntaria básica.');
 IF NOT EXISTS (SELECT 1 FROM dbo.hijos_personal WHERE codigo_hijo = N'H006')
  INSERT INTO dbo.hijos_personal (codigo_hijo, codigo_trabajador, edad_al_corte, cursa_superiores, acreditado, escolaridad_simulada, observacion) VALUES (N'H006', N'SIM008', 10, 0, 1, 1, N'Menor en educación básica; dato ficticio.');
 IF NOT EXISTS (SELECT 1 FROM dbo.hijos_personal WHERE codigo_hijo = N'H007')
  INSERT INTO dbo.hijos_personal (codigo_hijo, codigo_trabajador, edad_al_corte, cursa_superiores, acreditado, escolaridad_simulada, observacion) VALUES (N'H007', N'SIM010', 5, 0, 1, 0, N'Menor; habilita asignación familiar, no ayuda escolar simulada.');
 IF NOT EXISTS (SELECT 1 FROM dbo.hijos_personal WHERE codigo_hijo = N'H008')
  INSERT INTO dbo.hijos_personal (codigo_hijo, codigo_trabajador, edad_al_corte, cursa_superiores, acreditado, escolaridad_simulada, observacion) VALUES (N'H008', N'SIM010', 8, 0, 1, 1, N'Menor en educación básica; dato ficticio.');
 IF NOT EXISTS (SELECT 1 FROM dbo.beneficios_personal WHERE codigo_contrato = N'CT001')
  INSERT INTO dbo.beneficios_personal (codigo_contrato, bono_remunerativo_mes, bolsa_viveres_mes, movilidad_condicion_mes, alimentacion_condicion_mes, escolaridad_por_hijo_anual, canasta_navidad_anual, uniformes_epp_anual, examenes_capacitacion_anual, eps_empresa_mes, vida_ley_mes_estimada, sctr_salud_mes_estimada, sctr_pension_mes_estimada, accidente_adicional_mes, horas_extra_25_mes, horas_extra_35_mes, utilidades_anual, reemplazo_vacaciones_anual, observaciones) VALUES (N'CT001', 150, 0, 100, 0, 500, 120, 120, 100, 150, 15, 12, 10, 0, 2, 0, 0, 0, N'Primas Vida Ley y SCTR son hipótesis de póliza, no tarifas legales. Movilidad contra asistencia y alimentación indispensables para el trabajo: se suponen condiciones de trabajo, no pagos libres. La bolsa mensual de víveres es remunerativa y se incluye en bases; no se suma dos veces.');
 IF NOT EXISTS (SELECT 1 FROM dbo.beneficios_personal WHERE codigo_contrato = N'CT002')
  INSERT INTO dbo.beneficios_personal (codigo_contrato, bono_remunerativo_mes, bolsa_viveres_mes, movilidad_condicion_mes, alimentacion_condicion_mes, escolaridad_por_hijo_anual, canasta_navidad_anual, uniformes_epp_anual, examenes_capacitacion_anual, eps_empresa_mes, vida_ley_mes_estimada, sctr_salud_mes_estimada, sctr_pension_mes_estimada, accidente_adicional_mes, horas_extra_25_mes, horas_extra_35_mes, utilidades_anual, reemplazo_vacaciones_anual, observaciones) VALUES (N'CT002', 200, 60, 60, 130, 400, 120, 180, 100, 0, 18, 20, 18, 10, 8, 0, 0, 0, N'Primas Vida Ley y SCTR son hipótesis de póliza, no tarifas legales. Movilidad contra asistencia y alimentación indispensables para el trabajo: se suponen condiciones de trabajo, no pagos libres. La bolsa mensual de víveres es remunerativa y se incluye en bases; no se suma dos veces.');
 IF NOT EXISTS (SELECT 1 FROM dbo.beneficios_personal WHERE codigo_contrato = N'CT003')
  INSERT INTO dbo.beneficios_personal (codigo_contrato, bono_remunerativo_mes, bolsa_viveres_mes, movilidad_condicion_mes, alimentacion_condicion_mes, escolaridad_por_hijo_anual, canasta_navidad_anual, uniformes_epp_anual, examenes_capacitacion_anual, eps_empresa_mes, vida_ley_mes_estimada, sctr_salud_mes_estimada, sctr_pension_mes_estimada, accidente_adicional_mes, horas_extra_25_mes, horas_extra_35_mes, utilidades_anual, reemplazo_vacaciones_anual, observaciones) VALUES (N'CT003', 100, 0, 60, 130, 0, 120, 180, 100, 0, 15, 20, 18, 10, 4, 0, 0, 0, N'Primas Vida Ley y SCTR son hipótesis de póliza, no tarifas legales. Movilidad contra asistencia y alimentación indispensables para el trabajo: se suponen condiciones de trabajo, no pagos libres. La bolsa mensual de víveres es remunerativa y se incluye en bases; no se suma dos veces.');
 IF NOT EXISTS (SELECT 1 FROM dbo.beneficios_personal WHERE codigo_contrato = N'CT004')
  INSERT INTO dbo.beneficios_personal (codigo_contrato, bono_remunerativo_mes, bolsa_viveres_mes, movilidad_condicion_mes, alimentacion_condicion_mes, escolaridad_por_hijo_anual, canasta_navidad_anual, uniformes_epp_anual, examenes_capacitacion_anual, eps_empresa_mes, vida_ley_mes_estimada, sctr_salud_mes_estimada, sctr_pension_mes_estimada, accidente_adicional_mes, horas_extra_25_mes, horas_extra_35_mes, utilidades_anual, reemplazo_vacaciones_anual, observaciones) VALUES (N'CT004', 0, 60, 60, 130, 350, 120, 180, 100, 0, 12, 20, 18, 0, 0, 0, 0, 0, N'Primas Vida Ley y SCTR son hipótesis de póliza, no tarifas legales. Movilidad contra asistencia y alimentación indispensables para el trabajo: se suponen condiciones de trabajo, no pagos libres. La bolsa mensual de víveres es remunerativa y se incluye en bases; no se suma dos veces.');
 IF NOT EXISTS (SELECT 1 FROM dbo.beneficios_personal WHERE codigo_contrato = N'CT005')
  INSERT INTO dbo.beneficios_personal (codigo_contrato, bono_remunerativo_mes, bolsa_viveres_mes, movilidad_condicion_mes, alimentacion_condicion_mes, escolaridad_por_hijo_anual, canasta_navidad_anual, uniformes_epp_anual, examenes_capacitacion_anual, eps_empresa_mes, vida_ley_mes_estimada, sctr_salud_mes_estimada, sctr_pension_mes_estimada, accidente_adicional_mes, horas_extra_25_mes, horas_extra_35_mes, utilidades_anual, reemplazo_vacaciones_anual, observaciones) VALUES (N'CT005', 0, 0, 100, 100, 0, 120, 120, 100, 0, 12, 12, 10, 0, 0, 0, 0, 0, N'Primas Vida Ley y SCTR son hipótesis de póliza, no tarifas legales. Movilidad contra asistencia y alimentación indispensables para el trabajo: se suponen condiciones de trabajo, no pagos libres. La bolsa mensual de víveres es remunerativa y se incluye en bases; no se suma dos veces.');
 IF NOT EXISTS (SELECT 1 FROM dbo.beneficios_personal WHERE codigo_contrato = N'CT006')
  INSERT INTO dbo.beneficios_personal (codigo_contrato, bono_remunerativo_mes, bolsa_viveres_mes, movilidad_condicion_mes, alimentacion_condicion_mes, escolaridad_por_hijo_anual, canasta_navidad_anual, uniformes_epp_anual, examenes_capacitacion_anual, eps_empresa_mes, vida_ley_mes_estimada, sctr_salud_mes_estimada, sctr_pension_mes_estimada, accidente_adicional_mes, horas_extra_25_mes, horas_extra_35_mes, utilidades_anual, reemplazo_vacaciones_anual, observaciones) VALUES (N'CT006', 0, 0, 60, 100, 0, 120, 120, 100, 0, 12, 12, 10, 0, 0, 0, 0, 0, N'Primas Vida Ley y SCTR son hipótesis de póliza, no tarifas legales. Movilidad contra asistencia y alimentación indispensables para el trabajo: se suponen condiciones de trabajo, no pagos libres. La bolsa mensual de víveres es remunerativa y se incluye en bases; no se suma dos veces.');
 IF NOT EXISTS (SELECT 1 FROM dbo.beneficios_personal WHERE codigo_contrato = N'CT007')
  INSERT INTO dbo.beneficios_personal (codigo_contrato, bono_remunerativo_mes, bolsa_viveres_mes, movilidad_condicion_mes, alimentacion_condicion_mes, escolaridad_por_hijo_anual, canasta_navidad_anual, uniformes_epp_anual, examenes_capacitacion_anual, eps_empresa_mes, vida_ley_mes_estimada, sctr_salud_mes_estimada, sctr_pension_mes_estimada, accidente_adicional_mes, horas_extra_25_mes, horas_extra_35_mes, utilidades_anual, reemplazo_vacaciones_anual, observaciones) VALUES (N'CT007', 100, 0, 100, 100, 0, 120, 120, 100, 0, 12, 12, 10, 0, 4, 0, 0, 0, N'Primas Vida Ley y SCTR son hipótesis de póliza, no tarifas legales. Movilidad contra asistencia y alimentación indispensables para el trabajo: se suponen condiciones de trabajo, no pagos libres. La bolsa mensual de víveres es remunerativa y se incluye en bases; no se suma dos veces.');
 IF NOT EXISTS (SELECT 1 FROM dbo.beneficios_personal WHERE codigo_contrato = N'CT008')
  INSERT INTO dbo.beneficios_personal (codigo_contrato, bono_remunerativo_mes, bolsa_viveres_mes, movilidad_condicion_mes, alimentacion_condicion_mes, escolaridad_por_hijo_anual, canasta_navidad_anual, uniformes_epp_anual, examenes_capacitacion_anual, eps_empresa_mes, vida_ley_mes_estimada, sctr_salud_mes_estimada, sctr_pension_mes_estimada, accidente_adicional_mes, horas_extra_25_mes, horas_extra_35_mes, utilidades_anual, reemplazo_vacaciones_anual, observaciones) VALUES (N'CT008', 0, 60, 60, 130, 300, 120, 180, 100, 0, 12, 20, 18, 0, 0, 0, 0, 0, N'Primas Vida Ley y SCTR son hipótesis de póliza, no tarifas legales. Movilidad contra asistencia y alimentación indispensables para el trabajo: se suponen condiciones de trabajo, no pagos libres. La bolsa mensual de víveres es remunerativa y se incluye en bases; no se suma dos veces.');
 IF NOT EXISTS (SELECT 1 FROM dbo.beneficios_personal WHERE codigo_contrato = N'CT009')
  INSERT INTO dbo.beneficios_personal (codigo_contrato, bono_remunerativo_mes, bolsa_viveres_mes, movilidad_condicion_mes, alimentacion_condicion_mes, escolaridad_por_hijo_anual, canasta_navidad_anual, uniformes_epp_anual, examenes_capacitacion_anual, eps_empresa_mes, vida_ley_mes_estimada, sctr_salud_mes_estimada, sctr_pension_mes_estimada, accidente_adicional_mes, horas_extra_25_mes, horas_extra_35_mes, utilidades_anual, reemplazo_vacaciones_anual, observaciones) VALUES (N'CT009', 0, 0, 0, 0, 0, 120, 120, 100, 0, 12, 12, 10, 0, 0, 0, 0, 0, N'Primas Vida Ley y SCTR son hipótesis de póliza, no tarifas legales. Movilidad contra asistencia y alimentación indispensables para el trabajo: se suponen condiciones de trabajo, no pagos libres. La bolsa mensual de víveres es remunerativa y se incluye en bases; no se suma dos veces.');
 IF NOT EXISTS (SELECT 1 FROM dbo.beneficios_personal WHERE codigo_contrato = N'CT010')
  INSERT INTO dbo.beneficios_personal (codigo_contrato, bono_remunerativo_mes, bolsa_viveres_mes, movilidad_condicion_mes, alimentacion_condicion_mes, escolaridad_por_hijo_anual, canasta_navidad_anual, uniformes_epp_anual, examenes_capacitacion_anual, eps_empresa_mes, vida_ley_mes_estimada, sctr_salud_mes_estimada, sctr_pension_mes_estimada, accidente_adicional_mes, horas_extra_25_mes, horas_extra_35_mes, utilidades_anual, reemplazo_vacaciones_anual, observaciones) VALUES (N'CT010', 0, 0, 60, 130, 0, 120, 180, 100, 0, 12, 20, 18, 0, 0, 0, 0, 0, N'Primas Vida Ley y SCTR son hipótesis de póliza, no tarifas legales. Movilidad contra asistencia y alimentación indispensables para el trabajo: se suponen condiciones de trabajo, no pagos libres. La bolsa mensual de víveres es remunerativa y se incluye en bases; no se suma dos veces.');
 IF NOT EXISTS (SELECT 1 FROM dbo.beneficios_personal WHERE codigo_contrato = N'CT011')
  INSERT INTO dbo.beneficios_personal (codigo_contrato, bono_remunerativo_mes, bolsa_viveres_mes, movilidad_condicion_mes, alimentacion_condicion_mes, escolaridad_por_hijo_anual, canasta_navidad_anual, uniformes_epp_anual, examenes_capacitacion_anual, eps_empresa_mes, vida_ley_mes_estimada, sctr_salud_mes_estimada, sctr_pension_mes_estimada, accidente_adicional_mes, horas_extra_25_mes, horas_extra_35_mes, utilidades_anual, reemplazo_vacaciones_anual, observaciones) VALUES (N'CT011', 0, 0, 60, 100, 0, 120, 120, 100, 0, 12, 12, 10, 0, 0, 0, 0, 0, N'Primas Vida Ley y SCTR son hipótesis de póliza, no tarifas legales. Movilidad contra asistencia y alimentación indispensables para el trabajo: se suponen condiciones de trabajo, no pagos libres. La bolsa mensual de víveres es remunerativa y se incluye en bases; no se suma dos veces.');
 IF NOT EXISTS (SELECT 1 FROM dbo.beneficios_personal WHERE codigo_contrato = N'CT012')
  INSERT INTO dbo.beneficios_personal (codigo_contrato, bono_remunerativo_mes, bolsa_viveres_mes, movilidad_condicion_mes, alimentacion_condicion_mes, escolaridad_por_hijo_anual, canasta_navidad_anual, uniformes_epp_anual, examenes_capacitacion_anual, eps_empresa_mes, vida_ley_mes_estimada, sctr_salud_mes_estimada, sctr_pension_mes_estimada, accidente_adicional_mes, horas_extra_25_mes, horas_extra_35_mes, utilidades_anual, reemplazo_vacaciones_anual, observaciones) VALUES (N'CT012', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, N'Honorarios de prestador autónomo; sin beneficios laborales pagados por la cevichería.');
 IF NOT EXISTS (SELECT 1 FROM dbo.beneficios_personal WHERE codigo_contrato = N'CT013')
  INSERT INTO dbo.beneficios_personal (codigo_contrato, bono_remunerativo_mes, bolsa_viveres_mes, movilidad_condicion_mes, alimentacion_condicion_mes, escolaridad_por_hijo_anual, canasta_navidad_anual, uniformes_epp_anual, examenes_capacitacion_anual, eps_empresa_mes, vida_ley_mes_estimada, sctr_salud_mes_estimada, sctr_pension_mes_estimada, accidente_adicional_mes, horas_extra_25_mes, horas_extra_35_mes, utilidades_anual, reemplazo_vacaciones_anual, observaciones) VALUES (N'CT013', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, N'Honorarios de prestador autónomo; sin beneficios laborales pagados por la cevichería.');
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT001' AND dia_iso = 2)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT001', 2);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT001' AND dia_iso = 3)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT001', 3);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT001' AND dia_iso = 4)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT001', 4);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT001' AND dia_iso = 5)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT001', 5);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT001' AND dia_iso = 6)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT001', 6);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT001' AND dia_iso = 7)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT001', 7);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT002' AND dia_iso = 2)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT002', 2);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT002' AND dia_iso = 3)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT002', 3);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT002' AND dia_iso = 4)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT002', 4);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT002' AND dia_iso = 5)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT002', 5);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT002' AND dia_iso = 6)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT002', 6);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT002' AND dia_iso = 7)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT002', 7);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT003' AND dia_iso = 2)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT003', 2);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT003' AND dia_iso = 3)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT003', 3);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT003' AND dia_iso = 4)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT003', 4);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT003' AND dia_iso = 5)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT003', 5);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT003' AND dia_iso = 6)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT003', 6);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT003' AND dia_iso = 7)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT003', 7);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT004' AND dia_iso = 2)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT004', 2);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT004' AND dia_iso = 3)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT004', 3);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT004' AND dia_iso = 4)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT004', 4);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT004' AND dia_iso = 5)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT004', 5);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT004' AND dia_iso = 6)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT004', 6);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT004' AND dia_iso = 7)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT004', 7);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT005' AND dia_iso = 2)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT005', 2);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT005' AND dia_iso = 3)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT005', 3);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT005' AND dia_iso = 4)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT005', 4);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT005' AND dia_iso = 5)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT005', 5);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT005' AND dia_iso = 6)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT005', 6);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT005' AND dia_iso = 7)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT005', 7);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT006' AND dia_iso = 2)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT006', 2);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT006' AND dia_iso = 3)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT006', 3);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT006' AND dia_iso = 4)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT006', 4);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT006' AND dia_iso = 5)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT006', 5);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT006' AND dia_iso = 6)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT006', 6);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT006' AND dia_iso = 7)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT006', 7);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT007' AND dia_iso = 2)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT007', 2);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT007' AND dia_iso = 3)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT007', 3);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT007' AND dia_iso = 4)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT007', 4);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT007' AND dia_iso = 5)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT007', 5);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT007' AND dia_iso = 6)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT007', 6);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT007' AND dia_iso = 7)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT007', 7);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT008' AND dia_iso = 2)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT008', 2);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT008' AND dia_iso = 3)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT008', 3);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT008' AND dia_iso = 4)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT008', 4);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT008' AND dia_iso = 5)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT008', 5);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT008' AND dia_iso = 6)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT008', 6);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT008' AND dia_iso = 7)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT008', 7);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT009' AND dia_iso = 2)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT009', 2);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT009' AND dia_iso = 3)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT009', 3);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT009' AND dia_iso = 4)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT009', 4);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT009' AND dia_iso = 5)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT009', 5);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT009' AND dia_iso = 6)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT009', 6);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT009' AND dia_iso = 7)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT009', 7);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT010' AND dia_iso = 2)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT010', 2);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT010' AND dia_iso = 3)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT010', 3);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT010' AND dia_iso = 4)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT010', 4);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT010' AND dia_iso = 5)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT010', 5);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT010' AND dia_iso = 6)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT010', 6);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT010' AND dia_iso = 7)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT010', 7);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT011' AND dia_iso = 2)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT011', 2);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT011' AND dia_iso = 3)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT011', 3);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT011' AND dia_iso = 4)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT011', 4);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT011' AND dia_iso = 5)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT011', 5);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT011' AND dia_iso = 6)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT011', 6);
 IF NOT EXISTS (SELECT 1 FROM dbo.jornadas_personal WHERE codigo_contrato = N'CT011' AND dia_iso = 7)
  INSERT INTO dbo.jornadas_personal (codigo_contrato, dia_iso) VALUES (N'CT011', 7);
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-01')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-01', 2026, 4, 1, N'Año Nuevo');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-02')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-02', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-03')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-03', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-04')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-04', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-05')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-05', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-06')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-06', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-07')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-07', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-08')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-08', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-09')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-09', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-10')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-10', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-11')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-11', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-12')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-12', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-13')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-13', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-14')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-14', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-15')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-15', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-16')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-16', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-17')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-17', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-18')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-18', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-19')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-19', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-20')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-20', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-21')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-21', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-22')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-22', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-23')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-23', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-24')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-24', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-25')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-25', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-26')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-26', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-27')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-27', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-28')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-28', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-29')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-29', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-30')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-30', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-01-31')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-01-31', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-01')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-01', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-02')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-02', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-03')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-03', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-04')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-04', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-05')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-05', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-06')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-06', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-07')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-07', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-08')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-08', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-09')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-09', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-10')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-10', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-11')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-11', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-12')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-12', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-13')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-13', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-14')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-14', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-15')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-15', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-16')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-16', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-17')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-17', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-18')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-18', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-19')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-19', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-20')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-20', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-21')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-21', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-22')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-22', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-23')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-23', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-24')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-24', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-25')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-25', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-26')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-26', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-27')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-27', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-02-28')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-02-28', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-01')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-01', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-02')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-02', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-03')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-03', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-04')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-04', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-05')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-05', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-06')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-06', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-07')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-07', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-08')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-08', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-09')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-09', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-10')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-10', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-11')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-11', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-12')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-12', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-13')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-13', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-14')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-14', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-15')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-15', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-16')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-16', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-17')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-17', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-18')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-18', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-19')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-19', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-20')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-20', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-21')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-21', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-22')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-22', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-23')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-23', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-24')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-24', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-25')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-25', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-26')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-26', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-27')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-27', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-28')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-28', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-29')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-29', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-30')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-30', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-03-31')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-03-31', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-01')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-01', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-02')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-02', 2026, 4, 1, N'Jueves Santo');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-03')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-03', 2026, 5, 1, N'Viernes Santo');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-04')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-04', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-05')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-05', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-06')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-06', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-07')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-07', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-08')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-08', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-09')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-09', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-10')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-10', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-11')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-11', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-12')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-12', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-13')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-13', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-14')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-14', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-15')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-15', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-16')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-16', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-17')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-17', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-18')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-18', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-19')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-19', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-20')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-20', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-21')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-21', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-22')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-22', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-23')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-23', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-24')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-24', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-25')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-25', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-26')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-26', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-27')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-27', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-28')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-28', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-29')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-29', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-04-30')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-04-30', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-01')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-01', 2026, 5, 1, N'Día del Trabajo');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-02')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-02', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-03')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-03', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-04')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-04', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-05')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-05', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-06')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-06', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-07')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-07', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-08')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-08', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-09')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-09', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-10')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-10', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-11')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-11', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-12')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-12', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-13')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-13', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-14')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-14', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-15')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-15', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-16')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-16', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-17')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-17', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-18')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-18', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-19')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-19', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-20')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-20', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-21')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-21', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-22')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-22', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-23')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-23', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-24')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-24', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-25')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-25', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-26')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-26', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-27')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-27', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-28')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-28', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-29')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-29', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-30')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-30', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-05-31')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-05-31', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-01')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-01', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-02')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-02', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-03')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-03', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-04')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-04', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-05')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-05', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-06')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-06', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-07')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-07', 2026, 7, 1, N'Batalla de Arica y Día de la Bandera');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-08')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-08', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-09')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-09', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-10')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-10', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-11')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-11', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-12')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-12', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-13')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-13', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-14')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-14', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-15')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-15', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-16')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-16', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-17')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-17', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-18')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-18', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-19')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-19', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-20')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-20', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-21')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-21', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-22')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-22', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-23')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-23', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-24')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-24', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-25')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-25', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-26')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-26', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-27')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-27', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-28')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-28', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-29')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-29', 2026, 1, 1, N'San Pedro y San Pablo');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-06-30')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-06-30', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-01')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-01', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-02')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-02', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-03')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-03', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-04')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-04', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-05')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-05', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-06')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-06', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-07')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-07', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-08')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-08', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-09')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-09', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-10')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-10', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-11')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-11', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-12')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-12', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-13')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-13', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-14')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-14', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-15')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-15', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-16')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-16', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-17')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-17', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-18')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-18', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-19')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-19', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-20')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-20', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-21')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-21', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-22')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-22', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-23')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-23', 2026, 4, 1, N'Día de la Fuerza Aérea');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-24')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-24', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-25')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-25', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-26')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-26', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-27')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-27', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-28')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-28', 2026, 2, 1, N'Fiestas Patrias');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-29')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-29', 2026, 3, 1, N'Fiestas Patrias');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-30')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-30', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-07-31')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-07-31', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-01')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-01', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-02')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-02', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-03')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-03', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-04')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-04', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-05')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-05', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-06')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-06', 2026, 4, 1, N'Batalla de Junín');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-07')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-07', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-08')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-08', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-09')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-09', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-10')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-10', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-11')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-11', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-12')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-12', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-13')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-13', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-14')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-14', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-15')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-15', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-16')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-16', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-17')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-17', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-18')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-18', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-19')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-19', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-20')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-20', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-21')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-21', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-22')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-22', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-23')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-23', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-24')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-24', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-25')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-25', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-26')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-26', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-27')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-27', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-28')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-28', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-29')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-29', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-30')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-30', 2026, 7, 1, N'Santa Rosa de Lima');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-08-31')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-08-31', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-01')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-01', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-02')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-02', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-03')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-03', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-04')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-04', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-05')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-05', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-06')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-06', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-07')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-07', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-08')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-08', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-09')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-09', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-10')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-10', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-11')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-11', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-12')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-12', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-13')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-13', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-14')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-14', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-15')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-15', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-16')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-16', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-17')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-17', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-18')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-18', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-19')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-19', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-20')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-20', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-21')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-21', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-22')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-22', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-23')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-23', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-24')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-24', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-25')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-25', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-26')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-26', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-27')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-27', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-28')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-28', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-29')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-29', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-09-30')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-09-30', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-01')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-01', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-02')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-02', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-03')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-03', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-04')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-04', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-05')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-05', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-06')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-06', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-07')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-07', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-08')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-08', 2026, 4, 1, N'Combate de Angamos');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-09')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-09', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-10')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-10', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-11')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-11', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-12')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-12', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-13')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-13', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-14')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-14', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-15')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-15', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-16')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-16', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-17')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-17', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-18')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-18', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-19')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-19', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-20')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-20', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-21')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-21', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-22')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-22', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-23')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-23', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-24')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-24', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-25')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-25', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-26')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-26', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-27')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-27', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-28')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-28', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-29')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-29', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-30')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-30', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-10-31')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-10-31', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-01')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-01', 2026, 7, 1, N'Todos los Santos');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-02')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-02', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-03')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-03', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-04')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-04', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-05')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-05', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-06')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-06', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-07')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-07', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-08')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-08', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-09')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-09', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-10')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-10', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-11')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-11', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-12')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-12', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-13')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-13', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-14')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-14', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-15')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-15', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-16')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-16', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-17')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-17', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-18')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-18', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-19')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-19', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-20')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-20', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-21')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-21', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-22')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-22', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-23')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-23', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-24')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-24', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-25')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-25', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-26')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-26', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-27')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-27', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-28')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-28', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-29')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-29', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-11-30')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-11-30', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-01')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-01', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-02')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-02', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-03')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-03', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-04')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-04', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-05')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-05', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-06')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-06', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-07')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-07', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-08')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-08', 2026, 2, 1, N'Inmaculada Concepción');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-09')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-09', 2026, 3, 1, N'Batalla de Ayacucho');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-10')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-10', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-11')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-11', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-12')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-12', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-13')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-13', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-14')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-14', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-15')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-15', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-16')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-16', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-17')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-17', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-18')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-18', 2026, 5, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-19')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-19', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-20')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-20', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-21')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-21', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-22')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-22', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-23')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-23', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-24')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-24', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-25')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-25', 2026, 5, 1, N'Navidad');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-26')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-26', 2026, 6, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-27')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-27', 2026, 7, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-28')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-28', 2026, 1, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-29')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-29', 2026, 2, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-30')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-30', 2026, 3, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.calendario_laboral WHERE fecha = N'2026-12-31')
  INSERT INTO dbo.calendario_laboral (fecha, anio, dia_iso, es_feriado, descripcion) VALUES (N'2026-12-31', 2026, 4, 0, N'');
 IF NOT EXISTS (SELECT 1 FROM dbo.vacaciones_personal WHERE codigo_contrato = N'CT001' AND anio = 2026)
  INSERT INTO dbo.vacaciones_personal (codigo_contrato, anio, fecha_inicio, fecha_fin, tipo_dias, observacion) VALUES (N'CT001', 2026, N'2026-02-03', N'2026-03-04', N'CALENDARIO', N'Bloque de vacaciones ficticio para calcular capacidad anual regularizada. Para no registrados representa el escenario con derechos reconocidos.');
 IF NOT EXISTS (SELECT 1 FROM dbo.vacaciones_personal WHERE codigo_contrato = N'CT002' AND anio = 2026)
  INSERT INTO dbo.vacaciones_personal (codigo_contrato, anio, fecha_inicio, fecha_fin, tipo_dias, observacion) VALUES (N'CT002', 2026, N'2026-01-06', N'2026-02-04', N'CALENDARIO', N'Bloque de vacaciones ficticio para calcular capacidad anual regularizada. Para no registrados representa el escenario con derechos reconocidos.');
 IF NOT EXISTS (SELECT 1 FROM dbo.vacaciones_personal WHERE codigo_contrato = N'CT003' AND anio = 2026)
  INSERT INTO dbo.vacaciones_personal (codigo_contrato, anio, fecha_inicio, fecha_fin, tipo_dias, observacion) VALUES (N'CT003', 2026, N'2026-03-03', N'2026-04-01', N'CALENDARIO', N'Bloque de vacaciones ficticio para calcular capacidad anual regularizada. Para no registrados representa el escenario con derechos reconocidos.');
 IF NOT EXISTS (SELECT 1 FROM dbo.vacaciones_personal WHERE codigo_contrato = N'CT004' AND anio = 2026)
  INSERT INTO dbo.vacaciones_personal (codigo_contrato, anio, fecha_inicio, fecha_fin, tipo_dias, observacion) VALUES (N'CT004', 2026, N'2026-04-07', N'2026-05-06', N'CALENDARIO', N'Bloque de vacaciones ficticio para calcular capacidad anual regularizada. Para no registrados representa el escenario con derechos reconocidos.');
 IF NOT EXISTS (SELECT 1 FROM dbo.vacaciones_personal WHERE codigo_contrato = N'CT005' AND anio = 2026)
  INSERT INTO dbo.vacaciones_personal (codigo_contrato, anio, fecha_inicio, fecha_fin, tipo_dias, observacion) VALUES (N'CT005', 2026, N'2026-05-05', N'2026-06-03', N'CALENDARIO', N'Bloque de vacaciones ficticio para calcular capacidad anual regularizada. Para no registrados representa el escenario con derechos reconocidos.');
 IF NOT EXISTS (SELECT 1 FROM dbo.vacaciones_personal WHERE codigo_contrato = N'CT006' AND anio = 2026)
  INSERT INTO dbo.vacaciones_personal (codigo_contrato, anio, fecha_inicio, fecha_fin, tipo_dias, observacion) VALUES (N'CT006', 2026, N'2026-06-02', N'2026-07-01', N'CALENDARIO', N'Bloque de vacaciones ficticio para calcular capacidad anual regularizada. Para no registrados representa el escenario con derechos reconocidos.');
 IF NOT EXISTS (SELECT 1 FROM dbo.vacaciones_personal WHERE codigo_contrato = N'CT007' AND anio = 2026)
  INSERT INTO dbo.vacaciones_personal (codigo_contrato, anio, fecha_inicio, fecha_fin, tipo_dias, observacion) VALUES (N'CT007', 2026, N'2026-08-04', N'2026-09-02', N'CALENDARIO', N'Bloque de vacaciones ficticio para calcular capacidad anual regularizada. Para no registrados representa el escenario con derechos reconocidos.');
 IF NOT EXISTS (SELECT 1 FROM dbo.vacaciones_personal WHERE codigo_contrato = N'CT008' AND anio = 2026)
  INSERT INTO dbo.vacaciones_personal (codigo_contrato, anio, fecha_inicio, fecha_fin, tipo_dias, observacion) VALUES (N'CT008', 2026, N'2026-09-01', N'2026-09-30', N'CALENDARIO', N'Bloque de vacaciones ficticio para calcular capacidad anual regularizada. Para no registrados representa el escenario con derechos reconocidos.');
 IF NOT EXISTS (SELECT 1 FROM dbo.vacaciones_personal WHERE codigo_contrato = N'CT009' AND anio = 2026)
  INSERT INTO dbo.vacaciones_personal (codigo_contrato, anio, fecha_inicio, fecha_fin, tipo_dias, observacion) VALUES (N'CT009', 2026, N'2026-07-07', N'2026-07-12', N'LABORABLES', N'Bloque de vacaciones ficticio para calcular capacidad anual regularizada. Para no registrados representa el escenario con derechos reconocidos.');
 IF NOT EXISTS (SELECT 1 FROM dbo.vacaciones_personal WHERE codigo_contrato = N'CT010' AND anio = 2026)
  INSERT INTO dbo.vacaciones_personal (codigo_contrato, anio, fecha_inicio, fecha_fin, tipo_dias, observacion) VALUES (N'CT010', 2026, N'2026-11-03', N'2026-12-02', N'CALENDARIO', N'Bloque de vacaciones ficticio para calcular capacidad anual regularizada. Para no registrados representa el escenario con derechos reconocidos.');
 IF NOT EXISTS (SELECT 1 FROM dbo.vacaciones_personal WHERE codigo_contrato = N'CT011' AND anio = 2026)
  INSERT INTO dbo.vacaciones_personal (codigo_contrato, anio, fecha_inicio, fecha_fin, tipo_dias, observacion) VALUES (N'CT011', 2026, N'2026-12-01', N'2026-12-30', N'CALENDARIO', N'Bloque de vacaciones ficticio para calcular capacidad anual regularizada. Para no registrados representa el escenario con derechos reconocidos.');
 COMMIT TRANSACTION;
END TRY
BEGIN CATCH
 IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
 THROW;
END CATCH;
GO

CREATE OR ALTER VIEW dbo.vista_hijos_personal AS
SELECT codigo_trabajador,
 SUM(CASE WHEN acreditado = 1 AND (edad_al_corte < 18 OR (edad_al_corte <= 24 AND cursa_superiores = 1)) THEN 1 ELSE 0 END) AS hijos_asignacion,
 SUM(CASE WHEN acreditado = 1 AND escolaridad_simulada = 1 THEN 1 ELSE 0 END) AS hijos_escolaridad
FROM dbo.hijos_personal GROUP BY codigo_trabajador;
GO

CREATE OR ALTER VIEW dbo.vista_horas_personal AS
WITH dias AS (
 SELECT c.codigo_contrato, cal.fecha, cal.es_feriado,
 CASE WHEN j.dia_iso IS NOT NULL THEN 1 ELSE 0 END AS es_jornada,
 CASE WHEN v.codigo_contrato IS NOT NULL THEN 1 ELSE 0 END AS es_vacacion,
 c.horas_dia, c.trabaja_feriados
 FROM dbo.contratos_personal c
 JOIN dbo.parametros_laborales p ON p.id_escenario = c.id_escenario
 JOIN dbo.calendario_laboral cal ON cal.anio = p.anio_calendario
 LEFT JOIN dbo.jornadas_personal j ON j.codigo_contrato = c.codigo_contrato AND j.dia_iso = cal.dia_iso
 LEFT JOIN dbo.vacaciones_personal v ON v.codigo_contrato = c.codigo_contrato AND v.anio = cal.anio AND cal.fecha BETWEEN v.fecha_inicio AND v.fecha_fin
 WHERE c.activo = 1 AND c.vinculo = N'DEPENDIENTE'
)
SELECT codigo_contrato, COUNT(*) AS dias_calendario,
 SUM(CASE WHEN es_vacacion = 1 THEN 1 ELSE 0 END) AS dias_vacaciones_calendario,
 SUM(CASE WHEN es_jornada = 0 THEN 1 ELSE 0 END) AS dias_descanso_semanal,
 SUM(CASE WHEN es_jornada = 1 AND es_vacacion = 1 THEN 1 ELSE 0 END) AS dias_vacaciones_en_jornada,
 SUM(CASE WHEN es_jornada = 1 AND es_vacacion = 0 AND es_feriado = 1 AND trabaja_feriados = 0 THEN 1 ELSE 0 END) AS feriados_descansados,
 SUM(CASE WHEN es_jornada = 1 AND es_vacacion = 0 AND es_feriado = 1 AND trabaja_feriados = 1 THEN 1 ELSE 0 END) AS feriados_trabajados,
 SUM(CASE WHEN es_jornada = 1 AND es_vacacion = 0 AND (es_feriado = 0 OR trabaja_feriados = 1) THEN 1 ELSE 0 END) AS dias_trabajados_programados,
 SUM(CASE WHEN es_jornada = 1 AND es_vacacion = 0 AND (es_feriado = 0 OR trabaja_feriados = 1) THEN horas_dia ELSE 0 END) AS horas_programadas_ordinarias
FROM dias GROUP BY codigo_contrato;
GO

CREATE OR ALTER VIEW dbo.vista_bases_laborales AS
WITH base AS (
 SELECT c.*, t.nombres, t.apellidos, t.cargo, a.nombre AS area, a.clasificacion_costo,
 p.rmv, p.uit, p.tasa_asignacion, p.tasa_essalud, p.tasa_bonificacion_grati_essalud,
 p.tasa_bonificacion_grati_eps, p.tasa_credito_eps, p.tasa_onp,
 p.tasa_afp_aporte, p.tasa_afp_prima, p.tasa_afp_flujo, p.tope_prima_afp,
 p.tasa_cuarta, p.limite_recibo_sin_retencion, p.dias_semana_empresa,
 COALESCE(h.hijos_asignacion,0) AS hijos_asignacion, COALESCE(h.hijos_escolaridad,0) AS hijos_escolaridad,
 b.bono_remunerativo_mes, b.bolsa_viveres_mes, b.movilidad_condicion_mes,
 b.alimentacion_condicion_mes, b.escolaridad_por_hijo_anual, b.canasta_navidad_anual,
 b.uniformes_epp_anual, b.examenes_capacitacion_anual, b.eps_empresa_mes,
 b.vida_ley_mes_estimada, b.sctr_salud_mes_estimada, b.sctr_pension_mes_estimada,
 b.accidente_adicional_mes, b.horas_extra_25_mes, b.horas_extra_35_mes,
 b.utilidades_anual, b.reemplazo_vacaciones_anual,
 COALESCE(j.dias_calendario,0) AS dias_calendario,
 COALESCE(j.dias_vacaciones_calendario,0) AS dias_vacaciones_calendario,
 COALESCE(j.dias_descanso_semanal,0) AS dias_descanso_semanal,
 COALESCE(j.dias_vacaciones_en_jornada,0) AS dias_vacaciones_en_jornada,
 COALESCE(j.feriados_descansados,0) AS feriados_descansados,
 COALESCE(j.feriados_trabajados,0) AS feriados_trabajados,
 COALESCE(j.dias_trabajados_programados,0) AS dias_trabajados_programados,
 COALESCE(j.horas_programadas_ordinarias,0) AS horas_programadas_ordinarias,
 CAST(CASE WHEN c.vinculo = N'INDEPENDIENTE' AND c.tipo_pago = N'HORA' THEN c.tarifa * c.horas_servicio_mes
           WHEN c.tipo_pago = N'HORA' THEN c.tarifa * c.horas_dia * c.dias_semana * 52.0 / 12.0
           ELSE c.tarifa END AS DECIMAL(18,6)) AS remuneracion_basica_mes,
 CAST(CASE WHEN c.vinculo = N'DEPENDIENTE' AND COALESCE(h.hijos_asignacion,0) > 0 THEN p.rmv * p.tasa_asignacion / 100.0 ELSE 0 END AS DECIMAL(18,6)) AS asignacion_familiar_mes,
 CASE WHEN c.vinculo = N'INDEPENDIENTE' THEN 0 WHEN c.horas_dia * c.dias_semana / (p.dias_semana_empresa * 1.0) >= 4 THEN 30 ELSE 6 END AS dias_vacaciones_derecho,
 CASE WHEN c.vinculo = N'DEPENDIENTE' AND c.horas_dia * c.dias_semana / (p.dias_semana_empresa * 1.0) >= 4 THEN 1 ELSE 0 END AS aplica_cts
 FROM dbo.contratos_personal c
 JOIN dbo.trabajadores t ON t.codigo_trabajador = c.codigo_trabajador
 JOIN dbo.areas_personal a ON a.codigo_area = t.codigo_area
 JOIN dbo.parametros_laborales p ON p.id_escenario = c.id_escenario
 JOIN dbo.beneficios_personal b ON b.codigo_contrato = c.codigo_contrato
 LEFT JOIN dbo.vista_hijos_personal h ON h.codigo_trabajador = c.codigo_trabajador
 LEFT JOIN dbo.vista_horas_personal j ON j.codigo_contrato = c.codigo_contrato
 WHERE c.activo = 1 AND t.activo = 1
), ordinaria AS (
 SELECT base.*, remuneracion_basica_mes + asignacion_familiar_mes + bono_remunerativo_mes + bolsa_viveres_mes AS remuneracion_ordinaria_mes FROM base
), variables AS (
 SELECT ordinaria.*,
 CAST(CASE WHEN vinculo = N'DEPENDIENTE' THEN remuneracion_ordinaria_mes / 30.0 / NULLIF(horas_dia,0) * (horas_extra_25_mes * 1.25 + horas_extra_35_mes * 1.35) ELSE 0 END AS DECIMAL(18,6)) AS horas_extra_importe_mes,
 CAST(CASE WHEN vinculo = N'DEPENDIENTE' THEN remuneracion_ordinaria_mes / 30.0 * feriados_trabajados * 2 ELSE 0 END AS DECIMAL(18,6)) AS adicional_feriados_anual
 FROM ordinaria
)
SELECT variables.*, remuneracion_ordinaria_mes + horas_extra_importe_mes + adicional_feriados_anual / 12.0 AS remuneracion_computable_mes
FROM variables;
GO

CREATE OR ALTER VIEW dbo.vista_componentes_laborales AS
WITH bases AS (
 SELECT v.*,
 CAST(remuneracion_computable_mes * 12 AS DECIMAL(18,6)) AS remuneracion_anual,
 CAST(CASE WHEN vinculo = N'DEPENDIENTE' THEN remuneracion_computable_mes ELSE 0 END AS DECIMAL(18,6)) AS gratificacion_julio,
 CAST(CASE WHEN vinculo = N'DEPENDIENTE' THEN remuneracion_computable_mes ELSE 0 END AS DECIMAL(18,6)) AS gratificacion_diciembre,
 CAST(CASE WHEN aplica_cts = 1 THEN remuneracion_computable_mes * (1 + 1.0/6.0) ELSE 0 END AS DECIMAL(18,6)) AS cts_anual,
 CAST(CASE WHEN vinculo = N'DEPENDIENTE' THEN remuneracion_computable_mes / 30.0 * dias_vacaciones_derecho ELSE 0 END AS DECIMAL(18,6)) AS vacaciones_incluidas_anual,
 CAST(hijos_escolaridad * escolaridad_por_hijo_anual AS DECIMAL(18,6)) AS escolaridad_anual,
 CAST(CASE WHEN vinculo = N'DEPENDIENTE' THEN (CASE WHEN remuneracion_computable_mes > rmv THEN remuneracion_computable_mes ELSE rmv END) * tasa_essalud / 100.0 ELSE 0 END AS DECIMAL(18,6)) AS essalud_bruto_mes,
 CAST(CASE WHEN vinculo = N'INDEPENDIENTE' THEN horas_servicio_mes * 12 * factor_productivo
           ELSE (horas_programadas_ordinarias + (horas_extra_25_mes + horas_extra_35_mes) * 12) * factor_productivo END AS DECIMAL(18,6)) AS horas_efectivas_anual
 FROM dbo.vista_bases_laborales v
), credito AS (
 SELECT bases.*, CAST(CASE WHEN salud <> N'EPS' THEN 0
 ELSE CASE WHEN essalud_bruto_mes * tasa_credito_eps / 100.0 <= eps_empresa_mes AND essalud_bruto_mes * tasa_credito_eps / 100.0 <= uit * 0.1 THEN essalud_bruto_mes * tasa_credito_eps / 100.0
           WHEN eps_empresa_mes <= uit * 0.1 THEN eps_empresa_mes ELSE uit * 0.1 END END AS DECIMAL(18,6)) AS credito_eps_mes
 FROM bases
)
SELECT credito.*,
 CAST((gratificacion_julio + gratificacion_diciembre) * CASE WHEN salud = N'EPS' THEN tasa_bonificacion_grati_eps ELSE tasa_bonificacion_grati_essalud END / 100.0 AS DECIMAL(18,6)) AS bonificacion_extra_grati_anual,
 CAST((essalud_bruto_mes - credito_eps_mes) * 12 AS DECIMAL(18,6)) AS essalud_neto_anual,
 CAST(eps_empresa_mes * 12 AS DECIMAL(18,6)) AS eps_anual,
 CAST(vida_ley_mes_estimada * 12 AS DECIMAL(18,6)) AS vida_ley_anual,
 CAST(sctr_salud_mes_estimada * 12 AS DECIMAL(18,6)) AS sctr_salud_anual,
 CAST(sctr_pension_mes_estimada * 12 AS DECIMAL(18,6)) AS sctr_pension_anual,
 CAST(accidente_adicional_mes * 12 AS DECIMAL(18,6)) AS accidente_adicional_anual,
 CAST(movilidad_condicion_mes * 12 AS DECIMAL(18,6)) AS movilidad_anual,
 CAST(alimentacion_condicion_mes * 12 AS DECIMAL(18,6)) AS alimentacion_condicion_anual,
 CAST(CASE WHEN pension = N'ONP' THEN remuneracion_computable_mes * tasa_onp / 100.0
 WHEN pension IN (N'AFP_FLUJO',N'AFP_SALDO') THEN remuneracion_computable_mes * (tasa_afp_aporte + CASE WHEN pension = N'AFP_FLUJO' THEN tasa_afp_flujo ELSE 0 END) / 100.0
    + (CASE WHEN remuneracion_computable_mes < tope_prima_afp THEN remuneracion_computable_mes ELSE tope_prima_afp END) * tasa_afp_prima / 100.0 ELSE 0 END AS DECIMAL(18,6)) AS pension_descuento_mes,
 CAST(CASE WHEN vinculo = N'INDEPENDIENTE' AND tiene_suspension_cuarta = 0 AND remuneracion_basica_mes > limite_recibo_sin_retencion THEN remuneracion_basica_mes * tasa_cuarta / 100.0 ELSE 0 END AS DECIMAL(18,6)) AS cuarta_retencion_mes
FROM credito;
GO

CREATE OR ALTER VIEW dbo.vista_costo_anual_trabajador AS
WITH total AS (
 SELECT v.*,
 CAST(remuneracion_anual + gratificacion_julio + gratificacion_diciembre + bonificacion_extra_grati_anual
  + cts_anual + escolaridad_anual + canasta_navidad_anual + utilidades_anual
  + essalud_neto_anual + eps_anual + vida_ley_anual + sctr_salud_anual + sctr_pension_anual
  + accidente_adicional_anual + movilidad_anual + alimentacion_condicion_anual
  + uniformes_epp_anual + examenes_capacitacion_anual + reemplazo_vacaciones_anual AS DECIMAL(18,6)) AS costo_anual_completo,
 CASE WHEN vinculo = N'DEPENDIENTE' THEN remuneracion_anual + gratificacion_julio + gratificacion_diciembre + bonificacion_extra_grati_anual + escolaridad_anual + canasta_navidad_anual + utilidades_anual ELSE 0 END AS renta_quinta_bruta_anual
 FROM dbo.vista_componentes_laborales v
), renta AS (
 SELECT total.*, CASE WHEN renta_quinta_bruta_anual > uit * 7 THEN renta_quinta_bruta_anual - uit * 7 ELSE 0 END AS renta_quinta_neta_anual FROM total
), impuesto AS (
 SELECT renta.*, CAST(
  CASE WHEN renta_quinta_neta_anual <= uit*5 THEN renta_quinta_neta_anual*0.08
       WHEN renta_quinta_neta_anual <= uit*20 THEN uit*5*0.08 + (renta_quinta_neta_anual-uit*5)*0.14
       WHEN renta_quinta_neta_anual <= uit*35 THEN uit*5*0.08 + uit*15*0.14 + (renta_quinta_neta_anual-uit*20)*0.17
       WHEN renta_quinta_neta_anual <= uit*45 THEN uit*5*0.08 + uit*15*0.14 + uit*15*0.17 + (renta_quinta_neta_anual-uit*35)*0.20
       ELSE uit*5*0.08 + uit*15*0.14 + uit*15*0.17 + uit*10*0.20 + (renta_quinta_neta_anual-uit*45)*0.30 END AS DECIMAL(18,6)) AS quinta_impuesto_anual_estimado,
  CAST(CASE WHEN estado_planilla = N'NO_REGISTRADO' THEN (remuneracion_basica_mes + bono_remunerativo_mes + bolsa_viveres_mes) * 12
       + movilidad_anual + alimentacion_condicion_anual + escolaridad_anual + canasta_navidad_anual + uniformes_epp_anual + examenes_capacitacion_anual
       ELSE costo_anual_completo END AS DECIMAL(18,6)) AS desembolso_anual_simulado
 FROM renta
)
SELECT impuesto.*,
 CAST(costo_anual_completo / 12.0 AS DECIMAL(18,2)) AS costo_mensual_equivalente,
 CAST(costo_anual_completo / NULLIF(horas_efectivas_anual,0) AS DECIMAL(18,4)) AS costo_hora_efectiva,
 CAST(costo_anual_completo - desembolso_anual_simulado AS DECIMAL(18,2)) AS brecha_anual_costeo,
 CAST(CASE WHEN vinculo = N'INDEPENDIENTE' THEN remuneracion_basica_mes - cuarta_retencion_mes
      ELSE remuneracion_computable_mes - bolsa_viveres_mes - pension_descuento_mes - quinta_impuesto_anual_estimado/12.0 + movilidad_condicion_mes END AS DECIMAL(18,2)) AS neto_mensual_promedio_regularizado,
 CAST(cts_anual/12.0 AS DECIMAL(18,2)) AS provision_cts_mes,
 CAST((gratificacion_julio + gratificacion_diciembre + bonificacion_extra_grati_anual)/12.0 AS DECIMAL(18,2)) AS provision_grati_mes,
 CAST(vacaciones_incluidas_anual/12.0 AS DECIMAL(18,2)) AS vacaciones_asignacion_costeo_mes
FROM impuesto;
GO

CREATE OR ALTER VIEW dbo.vista_resumen_costos_personal AS
SELECT id_escenario, area, clasificacion_costo,
 COUNT(*) AS personas, SUM(CASE WHEN vinculo = N'DEPENDIENTE' THEN 1 ELSE 0 END) AS dependientes,
 CAST(SUM(costo_anual_completo) AS DECIMAL(18,2)) AS costo_anual,
 CAST(SUM(costo_anual_completo)/12.0 AS DECIMAL(18,2)) AS costo_mensual,
 CAST(SUM(desembolso_anual_simulado)/12.0 AS DECIMAL(18,2)) AS desembolso_mensual_simulado,
 CAST(SUM(brecha_anual_costeo)/12.0 AS DECIMAL(18,2)) AS brecha_mensual_costeo,
 CAST(SUM(horas_efectivas_anual) AS DECIMAL(18,2)) AS horas_efectivas_anual,
 CAST(SUM(costo_anual_completo)/NULLIF(SUM(horas_efectivas_anual),0) AS DECIMAL(18,4)) AS costo_hora_area
FROM dbo.vista_costo_anual_trabajador GROUP BY id_escenario, area, clasificacion_costo;
GO

CREATE OR ALTER VIEW dbo.vista_desglose_anual_personal AS
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 1 AS orden, N'Sueldo básico anual' AS concepto, CAST(remuneracion_basica_mes * 12 AS DECIMAL(18,6)) AS importe_anual, N'SUMA' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 2 AS orden, N'Asignación familiar anual' AS concepto, CAST(asignacion_familiar_mes * 12 AS DECIMAL(18,6)) AS importe_anual, N'SUMA' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 3 AS orden, N'Bonos remunerativos anuales' AS concepto, CAST(bono_remunerativo_mes * 12 AS DECIMAL(18,6)) AS importe_anual, N'SUMA' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 4 AS orden, N'Bolsa de víveres remunerativa anual' AS concepto, CAST(bolsa_viveres_mes * 12 AS DECIMAL(18,6)) AS importe_anual, N'SUMA' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 5 AS orden, N'Horas extra anuales' AS concepto, CAST(horas_extra_importe_mes * 12 AS DECIMAL(18,6)) AS importe_anual, N'SUMA' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 6 AS orden, N'Adicional feriados trabajados' AS concepto, CAST(adicional_feriados_anual AS DECIMAL(18,6)) AS importe_anual, N'SUMA' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 7 AS orden, N'Gratificación julio' AS concepto, CAST(gratificacion_julio AS DECIMAL(18,6)) AS importe_anual, N'SUMA' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 8 AS orden, N'Gratificación diciembre' AS concepto, CAST(gratificacion_diciembre AS DECIMAL(18,6)) AS importe_anual, N'SUMA' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 9 AS orden, N'Bonificación extraordinaria gratificaciones' AS concepto, CAST(bonificacion_extra_grati_anual AS DECIMAL(18,6)) AS importe_anual, N'SUMA' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 10 AS orden, N'Vacaciones pagadas: dentro de 12 sueldos' AS concepto, CAST(vacaciones_incluidas_anual AS DECIMAL(18,6)) AS importe_anual, N'INCLUIDO' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 11 AS orden, N'CTS anual' AS concepto, CAST(cts_anual AS DECIMAL(18,6)) AS importe_anual, N'SUMA' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 12 AS orden, N'Escolaridad voluntaria' AS concepto, CAST(escolaridad_anual AS DECIMAL(18,6)) AS importe_anual, N'SUMA' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 13 AS orden, N'Canasta de Navidad voluntaria' AS concepto, CAST(canasta_navidad_anual AS DECIMAL(18,6)) AS importe_anual, N'SUMA' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 14 AS orden, N'EsSalud neto de crédito EPS' AS concepto, CAST(essalud_neto_anual AS DECIMAL(18,6)) AS importe_anual, N'SUMA' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 15 AS orden, N'Prima EPS asumida por empresa' AS concepto, CAST(eps_anual AS DECIMAL(18,6)) AS importe_anual, N'SUMA' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 16 AS orden, N'Seguro Vida Ley' AS concepto, CAST(vida_ley_anual AS DECIMAL(18,6)) AS importe_anual, N'SUMA' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 17 AS orden, N'SCTR Salud' AS concepto, CAST(sctr_salud_anual AS DECIMAL(18,6)) AS importe_anual, N'SUMA' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 18 AS orden, N'SCTR Pensión' AS concepto, CAST(sctr_pension_anual AS DECIMAL(18,6)) AS importe_anual, N'SUMA' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 19 AS orden, N'Seguro accidente adicional voluntario' AS concepto, CAST(accidente_adicional_anual AS DECIMAL(18,6)) AS importe_anual, N'SUMA' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 20 AS orden, N'Movilidad como condición de trabajo' AS concepto, CAST(movilidad_anual AS DECIMAL(18,6)) AS importe_anual, N'SUMA' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 21 AS orden, N'Alimentación como condición de trabajo' AS concepto, CAST(alimentacion_condicion_anual AS DECIMAL(18,6)) AS importe_anual, N'SUMA' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 22 AS orden, N'Uniformes y EPP' AS concepto, CAST(uniformes_epp_anual AS DECIMAL(18,6)) AS importe_anual, N'SUMA' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 23 AS orden, N'Exámenes y capacitación' AS concepto, CAST(examenes_capacitacion_anual AS DECIMAL(18,6)) AS importe_anual, N'SUMA' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 24 AS orden, N'Utilidades: 0 en escenario de 11 dependientes' AS concepto, CAST(utilidades_anual AS DECIMAL(18,6)) AS importe_anual, N'SUMA' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 25 AS orden, N'Reemplazo durante vacaciones' AS concepto, CAST(reemplazo_vacaciones_anual AS DECIMAL(18,6)) AS importe_anual, N'SUMA' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 26 AS orden, N'AFP/ONP: descuento del trabajador' AS concepto, CAST(pension_descuento_mes * 12 AS DECIMAL(18,6)) AS importe_anual, N'DESCUENTO' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 27 AS orden, N'IR quinta estimado: descuento del trabajador' AS concepto, CAST(quinta_impuesto_anual_estimado AS DECIMAL(18,6)) AS importe_anual, N'DESCUENTO' AS tratamiento FROM dbo.vista_costo_anual_trabajador
UNION ALL
SELECT codigo_trabajador, codigo_contrato, nombres, apellidos, 28 AS orden, N'IR cuarta retenido: no reduce costo bruto' AS concepto, CAST(cuarta_retencion_mes * 12 AS DECIMAL(18,6)) AS importe_anual, N'DESCUENTO' AS tratamiento FROM dbo.vista_costo_anual_trabajador;
GO

CREATE OR ALTER VIEW dbo.vista_alertas_personal AS
SELECT codigo_trabajador, codigo_contrato,
 CASE WHEN estado_planilla = N'NO_REGISTRADO' THEN N'Dependiente no registrado: beneficios incluidos en costo completo; regularización pendiente.'
      WHEN vinculo = N'INDEPENDIENTE' THEN N'Servicio autónomo: confirmar que no existe subordinación.'
      WHEN aplica_cts = 0 THEN N'Tiempo parcial: gratificaciones, vacaciones 6 días y seguros; CTS no aplicable.'
      ELSE N'Dependiente del régimen general.' END AS observacion,
 CASE WHEN vinculo = N'DEPENDIENTE' AND remuneracion_basica_mes < rmv * (horas_dia * dias_semana) / 48.0 THEN N'Revisar remuneración mínima según jornada.' ELSE N'Tarifa compatible con el mínimo proporcional usado en este presupuesto.' END AS control_rmv,
 CASE WHEN vinculo = N'DEPENDIENTE' AND (vida_ley_mes_estimada = 0 OR sctr_salud_mes_estimada = 0 OR sctr_pension_mes_estimada = 0) THEN N'Revisar cobertura obligatoria del escenario.' ELSE N'Coberturas presupuestadas; primas estimadas.' END AS control_seguros,
 CASE WHEN vinculo = N'DEPENDIENTE' AND dias_calendario < 365 THEN N'Falta calendario anual para estimar capacidad.'
      WHEN vinculo = N'DEPENDIENTE' AND aplica_cts = 1 AND dias_vacaciones_calendario <> 30 THEN N'Revisar bloque de 30 días de vacaciones planificadas.'
      WHEN vinculo = N'DEPENDIENTE' AND aplica_cts = 0 AND dias_vacaciones_en_jornada <> 6 THEN N'Revisar 6 días laborables de vacaciones planificadas.'
      ELSE N'Calendario y vacaciones coherentes con el escenario.' END AS control_calendario
FROM dbo.vista_costo_anual_trabajador;
GO

-- Consultas de revisión: neto normalizado NO es la boleta de un mes específico.
SELECT codigo_trabajador, nombres, apellidos, cargo, vinculo, estado_planilla,
 remuneracion_basica_mes, asignacion_familiar_mes, remuneracion_computable_mes,
 neto_mensual_promedio_regularizado, costo_mensual_equivalente,
 horas_efectivas_anual, costo_hora_efectiva, brecha_anual_costeo
FROM dbo.vista_costo_anual_trabajador ORDER BY codigo_trabajador;

SELECT * FROM dbo.vista_resumen_costos_personal ORDER BY clasificacion_costo;
SELECT * FROM dbo.vista_desglose_anual_personal WHERE codigo_trabajador = N'SIM002' ORDER BY orden;
SELECT * FROM dbo.vista_alertas_personal ORDER BY codigo_trabajador;
GO
