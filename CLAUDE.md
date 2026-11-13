# Costea — rediseño y migración

Costea es una web app para que restaurantes calculen costos de platos, mano de obra, gastos, precios, producción y presupuestos.
Origen: proyecto del curso Contabilidad de Costos y Presupuestos (UNI). Hoy es Flask + SQL Server/Azure.
Idioma de la interfaz y de los datos: español (Perú), moneda PEN, IGV 18 %.

## Estructura del repositorio
- `legacy/`: el proyecto original en Flask (solo lectura y referencia; no se ejecuta, no se borra, no se edita).
- `brand/`: logo SVG, favicon, tokens de color y el video del chef.
- `app/`, `components/`, `lib/`, `supabase/`: el proyecto nuevo (Next.js), que se crea en la raíz.
- Secretos (claves de Supabase) solo en `.env.local`, que va en `.gitignore`. Nunca subirlos al repositorio.
- Trabajar por fases pequeñas y hacer un commit al terminar cada una. No leer `legacy/` completo: abrir solo los archivos que la fase necesite.

## Objetivo
Reconstruir TODO el frontend y el backend en **Next.js (App Router) + React + TypeScript + Supabase** (sin Azure ni SQL Server),
**conservando la lógica de negocio, los módulos y las reglas de cálculo**. Cambian: diseño, orden de la navegación, nombre visual de marca.

## Fuente de verdad de la lógica (no inventar fórmulas)
- Código viejo: `legacy/Costea-main/costos_app/app/services/` (costing, planning, payroll, inventory, recipes, materials, labor_*, overhead_tables, sales…).
- Reglas escritas: `legacy/Costea-main/GUIA_RAPIDA.md`, `legacy/Costea-main/costos_app/RESTAURANTES.md`, `legacy/Costea-main/costos_app/MEJORAS_EXCEL.md`, `legacy/Costea-main/costos_app/INVENTARIOS.md`.
- Las pruebas en `legacy/Costea-main/costos_app/tests/` son la especificación: portar los casos a Vitest y deben dar los mismos resultados.
  Caso de comprobación de `legacy/Costea-main/GUIA_RAPIDA.md`: ventas 12000, materiales 4800, MOD 2000 + no absorbida 400, utilidad 3600, margen 30 %.
- Cálculos monetarios con `decimal.js` (el original usa Decimal exacto). Nunca `number` para dinero.

## Datos
- Supabase Postgres. Portar las tablas de `legacy/Costea-main/costos_app/app/models/` y el catálogo de `legacy/Costea-main/cevicheria_costos_completo.sql`
  (categorias, unidades_medida, insumos, platos, receta_detalles, datos laborales simulados) a migraciones de Supabase.
- Auth con Supabase Auth (reemplaza users + Flask-Login). Aislamiento por restaurante con **RLS**
  (reemplaza las verificaciones de propietario que hoy hay en cada ruta). Cada restaurante ve solo lo suyo.
- Se conservan: versiones de recetas, versiones de precio de insumos, presupuestos publicados inmutables, kardex con promedio ponderado.

## Marca (carpeta `brand/`)
- Nombre: **costea** (minúsculas). Estilo moderno y amigable: esquinas redondeadas, espacio en blanco, tarjetas suaves.
- Logo: `costea-symbol.svg` (claro), `costea-symbol-white.svg` (oscuro), `favicon.svg`. El texto "costea" va como texto en Nunito bold junto al símbolo.
- Colores y tokens: `costea-tokens.css` (Tailwind v4 `@theme`). Verde `#006B4B`, lima `#A9D63A`, verde oscuro `#032A1F`.
- Fuentes: Plus Jakarta Sans (interfaz), Nunito (marca y títulos grandes) con `next/font`.
- UI: Tailwind + shadcn/ui + iconos Lucide. No usar Bootstrap.

## Reglas de diseño
- Todo UI nuevo usa los tokens y componentes de `DESIGN.md` (sin colores hex escritos a mano) y sigue el tema de shadcn.

## Navegación propuesta (menú lateral, por restaurante)
- **Inicio**: panel con progreso de configuración y resultados clave (reemplaza la guía de texto).
- **Preparar**: Insumos · Platos y recetas (con pestaña Precios) · Personal · Gastos (CIF, administración, ventas)
- **Costear**: Costo y precio por plato · Plan de producción · Presupuestos
- **Operar**: Ventas · Inventario
- **Analizar**: Reportes
- Arriba: selector de restaurante y de mes de trabajo. Datos del restaurante, unidades y periodos van en Configuración (menú del avatar).

## Orden de trabajo
1. Esqueleto Next.js + Tailwind + shadcn + tokens + layout con el menú.
2. Supabase: esquema, RLS, auth, datos del catálogo.
3. Portar el motor de costos a `lib/costing/` con pruebas.
4. Módulos en este orden: Restaurantes/periodos → Insumos → Platos y recetas → Personal → Gastos → Costo y precio → Plan → Presupuestos → Ventas → Inventario → Reportes.
5. Verificar contra el caso de comprobación y contra el Excel `legacy/Costea-main/2026 2 UNI CCP COSTOS DE RESTAURANTES.xlsx`.

## Página principal (landing) y chef 3D
- Rutas: `/` = landing pública que vende el servicio; `/ingresar` y `/registro` = acceso; `/app/...` = sistema (menú lateral de arriba).
- Secciones de la landing: portada con chef, Qué incluye (9 funciones reales), Cómo funciona (4 pasos), Qué ganas, Planes (precio y contenido por definir), Preguntas, cierre con botón, pie de página. No inventar testimonios ni cifras de clientes.
- Portada: pantalla completa, fondo crema cálido, texto a la izquierda en verde oscuro, chef a la derecha.
- El chef es un video de Kling: `brand/costea-chef-scrub.mp4` (1916×1080 reales, 97 cuadros a 24 fps = 4,04 s, con pista de audio AAC que se ignora; es un solo giro continuo generado en Kling con cuadro inicial, medio y final, sin empalmes).
  Recorrido: cuadro 0 = mira a la izquierda (hacia el texto) · ≈2,1 s (cuadro ~50) = de frente, reposo · último cuadro = mira a la derecha.
- Comportamiento: el video NO se reproduce; se pausa y se mueve `currentTime` según la posición horizontal del cursor
  (izquierda del chef → primera mitad del video; derecha → segunda mitad; reposo en D×0.52), con suavizado (lerp ≈ 0.14) en `requestAnimationFrame`.
  En celular, con el dedo (`touchmove`). Con `prefers-reduced-motion`, quedarse en el cuadro de frente.
- Máscara: el borde izquierdo del video se desvanece hacia el crema de la página (`mask-image`).
- El video trae marca de agua "KlingAI" abajo a la derecha: usar la exportación sin marca (plan de pago) antes de publicar.
- Maqueta de referencia de todas las pantallas: lienzo "Costea — maqueta de Inicio y menú" (Inicio, Inicio de sesión, Página principal, Portada con chef 3D).
- Implementación del hero: la especificación exacta está en `brand/HERO-REFERENCIA.md`. El chef no usa el `<video>`: se dibuja en un `<canvas>` con cuadros WebP precargados (`public/chef/` para escritorio, `public/chef-m/` para móvil, recortados y escalados alrededor del chef). En móvil el giro sigue el scroll de una escena anclada.
- Si se cambia el video, regenerar ambos juegos de cuadros con ffmpeg (97 cuadros cada uno) y revisar las poses extremas.
