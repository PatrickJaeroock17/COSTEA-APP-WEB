# DESIGN.md — reglas visuales de costea

Fuente de verdad visual para **landing (`/`), acceso (`/ingresar`, `/registro`, `/recuperar`, `/nueva-clave`) y app (`/app/...`)**.
Los tres usan **el mismo tema**: los tokens de marca de `brand/costea-tokens.css` mapeados a las variables de shadcn en `app/globals.css`.
Si este archivo y el código no coinciden, manda este archivo (o se actualiza aquí primero).

Principios: **cálido, claro, redondeado, sobrio**. Mucho espacio en blanco, tarjetas suaves, verde de marca como color de acción y lima solo como acento.
Nada de degradados morados/arcoíris, sombras exageradas, brillos ni "glassmorphism" genérico. La landing y el acceso sí usan profundidad en verde (aurora, puntos, haz en el borde), con las reglas de §13.

---

## 1. Paleta

### Marca
| Token (Tailwind) | Hex | Uso |
|---|---|---|
| `brand-50` | `#ecf8f2` | Fondo de selección, hover de menús, chips suaves, alerta de éxito |
| `brand-100` | `#d2efe1` | Insignias suaves |
| `brand-200` | `#a6dfc3` | Bordes de estado activo suave |
| `brand-300` | `#6fc89f` | Series secundarias de gráficos |
| `brand-400` | `#33a879` | — (reservado) |
| `brand-500` | `#0f8a62` | Éxito / cifras positivas |
| **`brand-600`** | **`#006b4b`** | **Color primario**: botones, enlaces, iconos activos, logo |
| `brand-700` | `#00563d` | Hover del primario, texto de etiquetas sobre fondos claros |
| `brand-800` | `#0b3f2e` | Superficies sobre el verde oscuro (tarjeta de usuario del menú) |
| **`brand-900`** | **`#032a1f`** | **Verde oscuro**: títulos, menú lateral, secciones oscuras |
| `lime-300` | `#cde98a` | Texto claro sobre verde oscuro (opcional) |
| `lime-400` | `#bfe05f` | Hover de botones lima |
| **`lime-500`** | **`#a9d63a`** | **Acento**: círculo del CTA, checks, icono activo del menú, barra de progreso |
| `lime-600` | `#86ae25` | Borde/acento lima sobre blanco |

Regla de lima: **nunca como color de texto sobre blanco o crema** (no pasa contraste). Solo como relleno con texto `brand-900` encima, o como texto/icono sobre `brand-900`/`brand-600`.

### Crema (solo el marco de la portada)
| Token | Hex | Uso |
|---|---|---|
| `cream-50` | `#faf3e0` | Sin uso en la landing desde el rediseño (ver §13) |
| `cream-100` | `#faefd5` | Sin uso en la landing desde el rediseño (ver §13) |
| **`cream-200`** | **`#f4e6c9`** | **Crema de la portada** (debe coincidir con los cuadros del chef; solo dentro del marco redondeado) |
| `cream-300` | `#ead9b3` | Bordes y separadores sobre crema, serie "presupuesto" en gráficos |

La app (`/app`) no usa crema: usa `surface`. La landing tampoco, salvo el marco de la portada: usa `surface-page` (§13).

### Neutros (con matiz verde)
| Token | Hex | Uso |
|---|---|---|
| `heading` | `#032a1f` (= brand-900) | Títulos (h1–h3), cifras grandes |
| `ink` | `#12251f` | Texto de interfaz, etiquetas de formulario |
| `ink-soft` | `#3f524b` | Párrafos secundarios. Reemplaza también a `#2c3f38` |
| `muted-foreground` | `#5b6b65` | Texto de ayuda, encabezados de tabla, metadatos |
| `subtle` | `#8a9a93` | Solo placeholders y separadores con texto ("o") |
| `line` | `#e2e9e5` | Bordes de tarjetas, inputs secundarios, divisores |
| `line-soft` | `#eef2f0` | Separadores entre filas de tabla |
| `line-strong` | `#c9d6cf` | Borde de casillas de verificación personalizadas |
| `field` | `#f2f5f3` | Fondo de inputs en reposo |
| `surface` | `#f6f9f7` | Fondo de la app, hover de filas y botones fantasma |
| `surface-page` | `#f6f7f6` | Fondo único de la landing y de los paneles internos de sus tarjetas (§13) |
| `white` | `#ffffff` | Tarjetas, popovers, diálogos |
| `warning-strong` | `#9b5c00` | Texto de aviso "Sin precio" y "Pendiente" (más claro que `warning-text`) |
| `danger-strong` | `#7f2424` | Hover de botones de borrar y texto de confirmación de borrado (el fondo es `danger-text`) |
| `danger-soft-hover` | `#fbdcdc` | Hover del botón destructivo suave |

### Estados
| Estado | Fondo suave | Sólido | Texto (AA) |
|---|---|---|---|
| Éxito | `#e7f6ee` | `#0f8a62` | `#00563d` |
| Aviso | `#fff6e5` | `#e0a100` | `#7a4b00` |
| Error | `#fdecec` | `#d64545` | `#9b2c2c` |
| Info | `#eaf2fc` | `#2b7bd6` | `#1d5ba3` |

Regla: el color sólido es para iconos, bordes y puntos; el texto siempre usa la columna "Texto". Un solo rojo para bordes de error: `#d64545`.

### Gráficos (en este orden)
`chart-1 #006b4b` · `chart-2 #a9d63a` · `chart-3 #6fc89f` · `chart-4 #ead9b3` · `chart-5 #032a1f`.
Real vs. presupuesto: real = `brand-600`, presupuesto = `cream-300`.

### Superficies oscuras de marca
Menú lateral, sección Planes y cierre de la landing usan `brand-900`. **No es un modo oscuro**: costea es solo tema claro por ahora.
Sobre `brand-900`: texto `#ffffff`, texto secundario `#cfe3da`, iconos `#9dc0b0`, rótulos `#7fa393`, ítem activo `#0f4d38`, acento `lime-500`.

Tokens del menú lateral (no escribir los hex en los componentes):

| Clase | Valor | Para |
|---|---|---|
| `bg-sidebar` | `#032a1f` | Fondo del menú lateral y del cajón móvil |
| `text-sidebar-foreground` | `#cfe3da` | Texto de los ítems |
| `text-sidebar-icon` | `#9dc0b0` | Iconos de ítems inactivos, correo del usuario, botones de la tarjeta de usuario |
| `text-sidebar-label` | `#7fa393` | Rótulos de grupo (Preparar, Costear…) |
| `bg-sidebar-accent` / `text-sidebar-accent-foreground` | `#0f4d38` / `#ffffff` | Ítem activo |
| `bg-sidebar-primary` / `text-sidebar-primary` | `#a9d63a` | Icono activo, avatar |
| `bg-brand-800` | `#0b3f2e` | Tarjeta de usuario del menú |

---

## 2. Tipografía

| Familia | Variable | Pesos | Para |
|---|---|---|---|
| **Nunito** | `--font-nunito` → `font-brand` / `font-heading` | 700, 800 | Palabra "costea", h1–h3, títulos de tarjeta, cifras KPI |
| **Plus Jakarta Sans** | `--font-jakarta` → `font-sans` | 400–800 | Todo lo demás: texto, botones, formularios, tablas, menú |

Escala:
| Rol | Clases |
|---|---|
| Display (portada) | `font-brand font-extrabold text-[33px] md:text-[clamp(40px,4.6vw,62px)] leading-[1.04] tracking-display` |
| H2 sección landing | `font-brand font-extrabold text-4xl sm:text-5xl lg:text-6xl leading-display tracking-display`; la parte final puede ir en `text-primary` (§13) |
| H1 de módulo (app) / título de acceso | `font-brand font-extrabold text-3xl sm:text-4xl tracking-title` |
| H3 tarjeta | `font-brand font-extrabold text-lg` / `text-xl` |
| Cifra KPI | `font-brand font-extrabold text-2xl`–`text-4xl tabular-nums` |
| Lead | `text-lg leading-relaxed text-ink-soft` (landing) |
| Cuerpo | `text-body` (15)/`text-base`, `leading-relaxed` |
| Pequeño | `text-sm` (14) / `text-small` (13) |
| Rótulo / cabecera de tabla | `text-xs font-extrabold uppercase tracking-label text-muted-foreground` |
| Rótulo de grupo del menú | `text-caption font-bold uppercase tracking-overline text-sidebar-label` |
| Etiqueta tipo píldora | Portada: `text-[13px] font-bold text-brand-700 bg-white/70 rounded-full px-3.5 py-[7px]`. Secciones: chip blanco con borde `line` y punto lima (§13) |

Tokens de tamaño e interletrado (en `@theme` de `app/globals.css`; no usar los valores sueltos):
`text-body` 15 px · `text-small` 13 px · `text-caption` 11 px · `tracking-display` −0.025em · `tracking-title` −0.02em · `tracking-label` 0.06em · `tracking-overline` 0.12em · `leading-display` 1.05 (H2 de la landing y cierre).
Todo token propio nuevo se registra también en `lib/utils.ts` (tailwind-merge); si no, `cn()` lo descarta.

Reglas:
- Títulos en **tipo oración**, nunca en mayúsculas (las mayúsculas solo en rótulos y cabeceras de tabla).
- Cifras siempre con `tabular-nums`. Dinero: `S/ 10.00`; porcentajes con espacio fino: `18 %`. Vacío: `—`.
- Botones en Jakarta `font-extrabold` (800) o `font-bold` (700); nunca `font-medium`.

---

## 3. Radios

Base `--radius: 0.75rem` (12 px). Los radios se fijan en valores exactos (no multiplicadores) para que las clases de Tailwind signifiquen lo mismo en todo el proyecto:

| Clase | Valor | Para |
|---|---|---|
| `rounded-sm` | 6 px | Marcas pequeñas (leyendas de gráfico) |
| `rounded-md` | 8 px | Botones `xs`/`sm` de shadcn |
| `rounded-lg` | 10 px | Botones icono dentro de inputs |
| **`rounded-xl`** | **12 px** | **Controles**: inputs, botones de app, selects, ítems de menú |
| `rounded-2xl` | 16 px | Paneles internos, mosaicos de icono, popovers, tarjetas flotantes |
| **`rounded-3xl`** | **24 px** | **Tarjetas de la app y de la landing**, marco de la portada, ítems de acordeón/pasos |
| `rounded-4xl` | 28 px | Diálogos |
| `rounded-5xl` | 32 px | Contenedor de acceso y bloque de cierre (solo esos dos) |
| `rounded-full` | — | Píldoras: botones de landing, chips, avatares, insignias |

---

## 4. Sombras

Tres niveles más la sombra de tarjeta de la landing, todos tintados con `brand-900` (`rgb(3 42 31)`), nunca negro puro:

| Token | Valor | Para |
|---|---|---|
| `shadow-card` | filo de luz interior + `0 1px 2px …/0.05` + `0 16px 32px -18px …/0.16` | Tarjetas claras de la landing (con borde `line`), paso y pregunta activos |
| `shadow-badge` | filo de luz interior + `0 10px 20px -10px rgb(0 107 75 / 0.6)` | Insignias de icono con degradado verde |
| `shadow-dark` | filo de luz interior + `0 30px 60px -30px …/0.55` | Bloques `brand-900` de la landing |
| `shadow-deep` | `0 12px 30px -12px …/0.45` + `0 40px 90px -30px …/0.7` | Tarjeta de acceso sobre el fondo verde |
| `shadow-soft` | `0 10px 30px rgb(3 42 31 / 0.06)` | Reservada (antes: tarjetas de la landing) |
| `shadow-lift` | `0 18px 40px rgb(3 42 31 / 0.12)` | Hover de tarjetas, paso/pregunta activa, menús desplegables, popovers |
| `shadow-float` | `0 24px 60px rgb(3 42 31 / 0.18)` | Diálogos, contenedor de acceso, tarjetas flotantes de Qué ganas |

Prohibido en la app: opacidades > 0.18, `blur` > 60 px, sombras de color (lima/verde brillante), sombras internas decorativas. Las cuatro sombras de la landing y el acceso de la tabla son la única excepción.
En la app las tarjetas van **sin sombra**, solo con borde `line`; la sombra aparece al elevar (menús, diálogos).

Fondos decorativos (aurora, puntos): solo en la landing y el acceso, verde o lima, hechos con degradados radiales (no `filter: blur`), con los componentes de `components/landing/decor.tsx`. Nunca en la app. Ver §13.

---

## 5. Espaciado y layout

Base 4 px (escala de Tailwind). Objetivo táctil mínimo **44 px** (`min-h-11`/`size-11`).

| Contexto | Regla |
|---|---|
| Contenedor landing | `mx-auto w-full max-w-7xl px-4 sm:px-6` (`container` de `components/landing/styles.ts`): barra, marco de la portada, secciones y pie |
| Sección landing | `py-section` (36–64 px) y `scroll-mt-nav`; chip → título `mt-3`; título → contenido `mt-8` |
| Portada | marco `rounded-3xl bg-cream-200` dentro del contenedor; `md:px-16`, alto `clamp(620px, 100svh − barra − 16px, 820px)` (ver `brand/HERO-REFERENCIA.md`) |
| App: contenido | `px-4 py-8 sm:px-6 lg:px-8 lg:py-10`; menú lateral `w-sidebar` (280 px, contenido `lg:pl-sidebar`); barra superior `min-h-16` |
| App: entre bloques | `space-y-6` / `gap-6`; entre tarjetas de una rejilla `gap-4` |
| Tarjeta | app `p-5 sm:p-6`; landing `p-5 sm:p-6`; panel interno `p-4` |
| Formulario | campos `space-y-4`; grupos `gap-4` en rejilla de 2 columnas desde `sm` |

Fondos por zona: landing `surface-page` con bloques `brand-900` enmarcados (ver §13); acceso `surface-dark` (verde oscuro con degradado radial y puntos) con la tarjeta blanca encima; app `surface`.
Encabezados de sección de la landing: `components/landing/section-heading.tsx` (píldora + H2 + texto), no copiados a mano.
Maquetas de pantallas en la landing (demos, vistas previas): por dentro usan los tokens de la app (`line`, `surface`, `field`, `chart-*`); el panel que las contiene va en `surface-page`.

---

## 6. Botones

Una sola implementación: `components/ui/button.tsx` (shadcn) con estas variantes. Nada de `<button>` o `<Link>` con clases de botón escritas a mano.

### CTA principal — píldora verde con círculo lima
La acción más importante de la vista (en la landing: "Crear mi cuenta"). **Uno por vista.**
```
rounded-full bg-primary text-primary-foreground font-extrabold text-base
min-h-14 pl-6 pr-2 gap-6 inline-flex items-center justify-between
hover:bg-brand-700
└ círculo: size-10 rounded-full bg-lime-500 text-brand-900 grid place-items-center
  con icono ArrowUpRight (Lucide) size-5 strokeWidth 2.4
```
Sobre fondo `brand-900` se invierte: píldora `lime-500` (hover `lime-400`), texto `brand-900`, círculo `brand-900` con flecha `lime-500`.
En móvil puede ir a ancho completo (`w-full`).

### Resto de variantes
| Variante | Landing (píldora) | App y acceso (rect.) |
|---|---|---|
| `default` (primario) | `rounded-full bg-primary text-white min-h-12 px-6 font-extrabold` | `rounded-xl bg-primary text-white h-12 px-6 font-extrabold` (en barras de herramientas `h-10 px-4`) |
| `outline` (secundario) | `rounded-full border-[1.5px] border-primary text-primary bg-white/60 hover:bg-white/85` | `rounded-xl border border-line bg-white text-primary hover:bg-brand-50` |
| `ghost` | — | `rounded-xl text-ink hover:bg-surface` |
| `destructive` | — | `rounded-xl bg-[#fdecec] text-[#9b2c2c] hover:bg-[#fbdcdc]` |
| `link` | `text-primary font-bold hover:underline underline-offset-4` | igual |
| `icon` | — | `size-11 rounded-xl` (táctil) |

Reglas: hover = un tono más oscuro (sin `opacity`); foco `ring-4 ring-ring/15 border-ring` en controles con borde; en enlaces y botones sin borde, `focusRing` (claro) o `focusRingDark` (sobre `brand-900`) de `lib/utils.ts`; deshabilitado `opacity-60`; cargando = `Loader2` girando a la izquierda del texto. El primario siempre es `brand-600`; `brand-900` no es color de botón sobre fondo claro.
En una misma barra no se mezclan píldoras y rectángulos.

---

## 7. Tarjetas

| Tipo | Clases |
|---|---|
| Tarjeta de app | `rounded-3xl border border-line bg-card` (sin sombra) |
| Tarjeta de landing | `card` (clara) o `cardDark` (verde oscuro) de `components/landing/styles.ts`; sin hover si no es clicable |
| Panel interno | `rounded-2xl bg-surface-page` (landing) / `rounded-2xl bg-surface` (app) |
| Tarjeta KPI | tarjeta de app + rótulo `text-sm font-semibold text-muted-foreground` + cifra `font-brand text-3xl font-extrabold tabular-nums text-heading` |
| Mosaico de icono | App: `size-11 rounded-2xl` · principal `bg-brand-600 text-lime-500` · secundario `bg-brand-50 text-brand-600`. Landing: insignia `iconBadge` / `iconBadgeLime` (§13) |
| Estado vacío | `rounded-3xl border border-dashed border-brand-600/30 bg-white px-6 py-10 text-center` |
| Tarjeta oscura | `bg-brand-900 text-white`, mismos radios |

Usar `Card` de shadcn (`CardHeader`, `CardTitle` en `font-heading`, `CardContent`) con estas clases en el propio componente, no repetidas en cada página.

---

## 8. Tablas

Usar `Table` de shadcn, envuelta en tarjeta de app con `overflow-x-auto`.
- Cabecera: `border-b border-line` · celdas `px-4 py-3` · `text-xs font-extrabold uppercase tracking-[0.06em] text-muted-foreground`. Sin fondo (o `bg-surface` solo si la tabla es larga y su cabecera es fija).
- Filas: `border-b border-line-soft`, la última sin borde; hover `bg-surface/60`; celdas `px-4 py-3 text-sm`.
- Primera columna: nombre en `font-bold text-heading`, enlazado si tiene detalle.
- Números a la derecha, `tabular-nums`; totales en `font-bold` sobre fila con `border-t border-line`.
- Valores faltantes: `—` en `text-muted-foreground`.
- En móvil: `min-w-[…]` con desplazamiento horizontal, o lista de tarjetas si la tabla tiene más de 5 columnas y es de consulta frecuente.

---

## 9. Formularios

Usar `Field`/`Label`/`Input`/`Select`/`Textarea` de shadcn con este estilo (un solo `inputClass` en el componente):

| Parte | Estilo |
|---|---|
| Etiqueta | `text-sm font-bold text-ink`, `mb-1.5` |
| Input / select | `h-12 rounded-xl border border-transparent bg-field px-4 text-[15px] text-ink placeholder:text-subtle` |
| Foco | `focus-visible:border-ring focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-ring/15` |
| Error | `aria-invalid:border-[#d64545] aria-invalid:bg-white aria-invalid:ring-[#d64545]/15` + mensaje `text-xs font-semibold text-[#9b2c2c]` enlazado con `aria-describedby` |
| Ayuda | `text-xs text-muted-foreground mt-1.5` |
| Alerta del formulario | `rounded-xl px-4 py-3 text-sm` con par fondo/texto de la tabla de estados e icono `AlertCircle` / `CheckCircle2` |
| Acciones | botón primario a la derecha (app) o a ancho completo (acceso); secundario a su izquierda |

Selects y menús desplegables: `rounded-2xl border border-line bg-popover p-1.5 shadow-lift`; ítem `rounded-xl min-h-10 px-3`; seleccionado `bg-brand-50 text-brand-600` con `Check`.
Diálogos: `rounded-4xl bg-white p-6 sm:p-8 shadow-float`, fondo `bg-brand-900/50`; título `font-heading text-2xl`.

---

## 10. Iconos y movimiento

- Iconos: Lucide. `size-4` en línea con texto, `size-5` en menú y mosaicos, `size-6` en cabeceras. Grosor por defecto (2); 2.4–3 solo en flechas del CTA y checks.
- Duraciones: 150 ms menús, 300 ms hover/acordeones, 500 ms entradas. `ease-out`. Elevación máxima en hover: `-translate-y-1`.
- Todo movimiento continuo (flotación, contadores, giros) se apaga con `prefers-reduced-motion`.

---

## 11. Mapeo de tokens al tema de shadcn

Este bloque reemplaza `:root`, `.dark` y los radios de `@theme inline` en `app/globals.css`. Con él, `bg-primary`, `text-muted-foreground`, `border-border`, `rounded-xl`, etc. significan lo mismo en landing, acceso y app.

```css
/* Tokens de marca (añadir a @theme, junto a la paleta de brand/costea-tokens.css) */
@theme {
  --color-cream-50:  #faf3e0;
  --color-cream-100: #faefd5;
  --color-cream-200: #f4e6c9;
  --color-cream-300: #ead9b3;

  --color-heading:  #032a1f;
  --color-ink:      #12251f;
  --color-ink-soft: #3f524b;
  --color-subtle:   #8a9a93;
  --color-line:     #e2e9e5;
  --color-line-soft:#eef2f0;
  --color-field:    #f2f5f3;
  --color-surface:  #f6f9f7;
  /* Quitar --color-muted (#5b6b65): choca con el --color-muted de shadcn. Usar text-muted-foreground. */

  --shadow-soft:  0 10px 30px rgb(3 42 31 / 0.06);
  --shadow-lift:  0 18px 40px rgb(3 42 31 / 0.12);
  --shadow-float: 0 24px 60px rgb(3 42 31 / 0.18);
}

@theme inline {
  /* …colores de shadcn como ahora… */
  --radius-sm: 0.375rem;  /*  6px */
  --radius-md: 0.5rem;    /*  8px */
  --radius-lg: 0.625rem;  /* 10px */
  --radius-xl: 0.75rem;   /* 12px  controles */
  --radius-2xl: 1rem;     /* 16px  paneles */
  --radius-3xl: 1.5rem;   /* 24px  tarjetas app */
  --radius-4xl: 1.75rem;  /* 28px  tarjetas landing, diálogos */
}

:root {
  --radius: 0.75rem;

  --background: #f6f9f7;          /* surface: lienzo de la app; landing/acceso pintan su crema */
  --foreground: #12251f;          /* ink */
  --card: #ffffff;
  --card-foreground: #12251f;
  --popover: #ffffff;
  --popover-foreground: #12251f;

  --primary: #006b4b;             /* brand-600 */
  --primary-foreground: #ffffff;
  --secondary: #ecf8f2;           /* brand-50 */
  --secondary-foreground: #00563d;/* brand-700 */
  --muted: #f6f9f7;               /* surface */
  --muted-foreground: #5b6b65;
  --accent: #ecf8f2;              /* hover/selección en menús */
  --accent-foreground: #006b4b;
  --destructive: #d64545;

  --border: #e2e9e5;              /* line */
  --input: #e2e9e5;
  --ring: #006b4b;                /* se usa como ring-ring/15 */

  --chart-1: #006b4b;
  --chart-2: #a9d63a;
  --chart-3: #6fc89f;
  --chart-4: #ead9b3;
  --chart-5: #032a1f;

  --sidebar: #032a1f;             /* brand-900 */
  --sidebar-foreground: #cfe3da;
  --sidebar-primary: #a9d63a;     /* icono activo */
  --sidebar-primary-foreground: #032a1f;
  --sidebar-accent: #0f4d38;      /* ítem activo */
  --sidebar-accent-foreground: #ffffff;
  --sidebar-border: rgb(255 255 255 / 0.08);
  --sidebar-ring: #a9d63a;
}

/* Solo tema claro: borrar el bloque .dark (hoy trae grises de shadcn y un violeta en --sidebar-primary). */
```

Aplicado en `app/globals.css`, que es la fuente de verdad. `brand/costea-tokens.css` es una copia de referencia de su bloque `@theme`: si cambia un token, se cambia en `globals.css` y se vuelve a copiar. `bg-cream` se conserva como alias de `cream-100`.

---

## 12. Componentes nuevos

Orden de preferencia: **shadcn** (estilo `base-nova`, primitivas `@base-ui/react`) → **@smoothui** → **@magicui** (registros ya declarados en `components.json`).
Al traer uno:
1. Reemplazar cualquier color fijo por tokens (`primary`, `brand-*`, `lime-*`, `cream-*`, `line`…). Nada de `zinc`, `slate`, `gray`, `violet`, `purple`, `indigo`, `fuchsia`, `pink`.
2. Ajustar radios y sombras a las secciones 3 y 4.
3. Comprobar `prefers-reduced-motion` y contraste AA.
4. @magicui/@smoothui solo para la landing o para microinteracciones de la app (p. ej. contador de cifras, marquesina). Evitar los efectos de arcoíris, aurora, partículas, meteoros, haces de luz y bordes brillantes salvo que se rehagan solo con verde/lima y sin brillo.

---

## 13. Landing y acceso

La landing (`/`) es **una sola página continua en verde**: fondo claro con bloques en verde oscuro, profundidad y detalle. El acceso comparte el fondo oscuro. La app (`/app`) no cambia con esta sección.

### Superficies
| Superficie | Clases | Dónde |
|---|---|---|
| Página | `bg-surface-page` (`#f6f7f6`) | Toda la landing: barra, secciones claras y pie |
| Tarjeta clara | `card`: `rounded-3xl border border-line bg-linear-to-b from-white to-surface-page shadow-card` | Bento, franja de cifras, vista previa de Cómo funciona |
| Bloque oscuro | `cardDark`: `surface-dark rounded-3xl border border-white/10 shadow-dark` | Tarjeta destacada del bento, panel de Qué ganas, bloque Planes + cierre (`rounded-5xl`) |
| Panel interno | `panel`: `rounded-2xl border border-line-soft bg-surface-page`; dentro de un bloque oscuro, panel blanco `shadow-lift` | Demos y vistas previas |
| Marco de la portada | `rounded-3xl bg-cream-200` | Solo la portada: es el crema de los cuadros del chef |
| Acceso | `<main>` con `surface-dark` + `DotGrid tone="dark"`; tarjeta blanca `shadow-deep ring-1 ring-white/10` | `/ingresar`, `/registro`, `/recuperar`, `/nueva-clave` |

- `surface-dark` (`app/globals.css`): `brand-900` con dos degradados radiales muy sutiles (lima arriba a la derecha, verde abajo a la izquierda).
- **Sin crema fuera del marco de la portada.** Los bloques oscuros siempre van enmarcados (redondeados, dentro del contenedor), nunca como banda de borde a borde.
- Texto sobre verde oscuro: blanco para títulos, `sidebar-foreground` para párrafos, `lime-300` para rótulos y cifras. Todos pasan AA sobre `brand-900`. Foco sobre verde: `focusRingDark` o anillo blanco con separación `brand-900`.

### Profundidad (`components/landing/decor.tsx`)
- `Aurora` (`tone="light" | "dark"`): tres manchas verdes/lima hechas con `radial-gradient(closest-side, …)`. Va detrás del marco de la portada y dentro del bloque de cierre.
- `DotGrid` (`tone`): patrón de puntos de 22 px (`.dot-grid`) que se desvanece hacia los bordes (`.fade-radial`). En zonas claras `text-brand-900/10`; en oscuras `text-white/10`.
- Todo decorativo lleva `aria-hidden` y `pointer-events-none`. No se usa `filter: blur` en fondos.
- Bordes de 1 px: `line` en claro, `white/10` en oscuro; el "brillo" es el filo de luz interior de las sombras.

### Iconos
- Insignia `iconBadge`: 56 px, `rounded-2xl`, degradado `brand-500 → brand-700`, icono Lucide blanco `size-7`, `shadow-badge`. Sobre bloques oscuros, `iconBadgeLime` (degradado lima, icono `brand-900`).
- La misma receta, más chica, en los checks de Qué ganas (36 px) y en el paso activo de Cómo funciona (44 px, redondo).

### Ritmo
- Todas las secciones usan `section` (`relative py-section scroll-mt-nav`) y `container`. `--spacing-section` = `clamp(2.25rem, 4.5vw, 4rem)`.
- Chip → H2 `mt-3`; H2 → texto `mt-3`; encabezado → contenido `mt-8`. Rejillas de tarjetas con `gap-3` (12 px).
- Orden: portada · franja de cifras · Qué incluye · galería · Cómo funciona · Qué ganas · Preguntas · Planes + cierre · pie.

### Secciones
- **Portada**: aurora detrás del marco (con parallax leve), malla verde tenue dentro del marco del lado del texto y CTA con destello. Sin tarjetas flotantes: el marco lleva solo texto, botones y el chef. Textos e interacción del chef no se tocan.
- **Franja de cifras** (`proof-strip.tsx`): cuatro datos **del propio producto** (9 funciones, IGV 18 %, 4 pasos, recálculo al instante) y un marquee con tipos de negocio. **Nunca testimonios, logos de clientes ni reseñas.**
- **Qué incluye**: bento de 12 columnas con tamaños distintos (7 + 5, 6 + 3 + 3, 3 × 4). Tres demos en vivo; "Costo y precio por plato" es la tarjeta oscura con `BorderBeam`. Las seis tarjetas chicas llevan un micro-visual propio (`micro-visuals.tsx`), siempre con valores marcados como ejemplo.
- **Galería** (`gallery.tsx`): tira sin texto entre Qué incluye y Cómo funciona: tres fotos y un video corto. Escritorio: una fila de cuatro piezas de anchos y altos distintos, alineadas abajo. Móvil: rejilla de 2 columnas (foto ancha, dos verticales, foto ancha). Sin pies de foto.
- **Cómo funciona**: línea de tiempo vertical; un tramo une cada paso con el siguiente y se llena de verde al completarlo. Paso activo en tarjeta blanca con insignia. La vista previa lleva arriba la foto real del paso (`rounded-2xl`, velo `brand-900` al pie) y, montado sobre su borde inferior (`-mt-14`), el panel blanco `shadow-lift` con la vista de ejemplo.
- **Qué ganas**: lista clara a la izquierda; a la derecha, una foto grande del plato (`16/10`) y el panel `cardDark` con las barras en lima montado sobre su borde inferior, desplazados uno del otro 40 px en escritorio.
- **Planes + cierre**: un solo bloque `cardDark rounded-5xl` con aurora, chip "Próximamente", título grande, CTA lima con destello, tarjeta de cristal "Planes" y, a la derecha, un video de emplatado que se funde con el verde (`mask-image`). Encima del video van dos velos `brand-900` (horizontal y vertical): el lado del texto queda casi pleno y el texto mantiene AA. En móvil el video ocupa todo el bloque al 30 % de opacidad.

### Medios: fotos y videos reales (`components/landing/media.tsx`, archivos en `public/media/`)
- Solo stock con licencia gratuita para uso comercial (Pexels, Unsplash, Pixabay). Cada archivo se anota en `public/media/CREDITOS.md` (fuente, autor, URL, licencia). Los originales van en `medios-fuente/`, fuera del repositorio.
- Son ilustrativas: **sin pies de foto ni textos que las presenten como clientes de Costea**. Se prefieren manos, platos, insumos y cocina; nada de caras en primer plano.
- Marco `mediaFrame` (`styles.ts`): `relative isolate overflow-hidden rounded-3xl bg-brand-100 shadow-card`. Dentro de una tarjeta, `rounded-2xl` sin sombra. La proporción siempre se reserva con `aspect-*` o un alto fijo: sin CLS.
- Velo de marca (`Tint`): `soft` (`from-brand-900/30`) para teñir apenas; `base` (`from-brand-900/70`) cuando un panel se apoya sobre el pie de la foto. Sin filtros ni colores nuevos: no hizo falta ningún token.
- `Photo`: `next/image` con import estático (`placeholder="blur"`), `sizes` real de cada hueco, AVIF/WebP (`images.formats` en `next.config.ts`) y carga diferida. Ninguna foto está en la primera pantalla, así que ninguna lleva `priority`.
- `LoopVideo`: póster optimizado siempre visible; el `<video muted autoPlay loop playsInline preload="none" poster>` (WebM + MP4 H.264) solo se monta la primera vez que entra en pantalla y se pausa al salir. No se monta con `prefers-reduced-motion`, con ahorro de datos (`navigator.connection.saveData`), en redes 2G ni sin JS: queda el póster.
- Videos: sin audio, ≤ 8 s, ≤ 1080p, ≤ 2 MB (`ffmpeg -an -crf 28`). La receta está en `CREDITOS.md`.

### Barra superior (`components/landing/site-header.tsx`)
- `sticky top-0`, alto `h-nav` (64 px). Arriba es transparente; al bajar más de 8 px: `bg-white/80 backdrop-blur-[14px]` y línea inferior `line`.
- Rejilla `1fr auto 1fr`: logo · enlaces centrados (Qué incluye, Cómo funciona, Preguntas, Planes; el orden de la página) · Iniciar sesión + Crear cuenta.
- La sección que cruza el centro de la pantalla (IntersectionObserver) se marca con `aria-current` y un punto `bg-primary` bajo el enlace.
- Móvil: botón de menú (`aria-expanded`, `aria-controls`) que abre un panel dentro de la misma barra translúcida. Escape lo cierra y devuelve el foco al botón; elegir un enlace también lo cierra.

### Títulos de sección (`components/landing/section-heading.tsx`)
- Chip: `rounded-full border border-line bg-white text-small font-bold text-brand-700` con un punto `lime-500`.
- H2: `font-brand text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-display tracking-display text-heading`. La parte final va en `text-primary` con la prop `accent` (`title="Qué" accent="incluye"`).

### Pie (`components/landing/site-footer.tsx`)
- Fila: marca (logo, frase, redes en círculos de 44 px con `aria-label`) + 3 columnas con título `text-small text-muted-foreground` (Producto, Cuenta, Empresa). 2 columnas en tablet, 1 en móvil.
- Debajo, la palabra "costea" gigante, decorativa (`aria-hidden`): degradado de `brand-100` a transparente recortado al texto.
- Barra final con línea superior `line`: copyright a la izquierda, enlaces legales a la derecha.

### Componentes de Magic UI (`components/ui/`, licencia MIT, instalados con el CLI de shadcn y adaptados)
| Componente | Dónde | Adaptación |
|---|---|---|
| `number-ticker` | Franja de cifras | El servidor entrega el valor final; cuenta una vez al entrar; formato es-PE; sin colores propios |
| `marquee` | Tipos de negocio | Solo horizontal; copias con `aria-hidden`; quieto con movimiento reducido |
| `border-beam` | Tarjeta oscura del bento y bloque de cierre | Colores con tokens (lima → verde); animación en CSS en vez de motion |
| `shimmer-button` | CTA "Crear mi cuenta" de la portada y del cierre | Reescrito como `ShimmerLink` (enlace) con la forma del CTA de §6 y tokens |

No se usa `dot-pattern` de Magic UI (pinta un `<circle>` animable por punto: miles de nodos); el patrón es CSS (`.dot-grid`). Tampoco `bento-grid` (arrastra dependencias que no usamos): el bento es una rejilla propia.

### Movimiento (paquete `motion`, import desde `"motion/react"`)
- `components/motion/reveal.tsx`: `Reveal` (un bloque) y `Stagger` (los hijos directos en cascada de 70 ms; sirve como rejilla). Entrada única al hacer scroll: opacidad + `translateY(18px)`, 600 ms, curva `EASE` `[0.22, 1, 0.36, 1]`.
- **El HTML sale visible del servidor.** Solo se oculta, ya con JS, lo que está por debajo de la pantalla; por eso no hay CLS y con JS lento o sin JS el contenido se lee igual. No usar `initial={{ opacity: 0 }}` en contenido de la landing.
- `components/motion/parallax.tsx`: `Parallax`, desplazamiento vertical de ±28–40 px ligado al scroll. **Solo para fondos decorativos** (las dos auroras).
- `components/motion/in-view.tsx`: `InView` marca `data-inview`; con `"false"`, `app/globals.css` pausa todas las animaciones CSS de dentro. **Todo lo que anima en bucle (marquee, destello del CTA, haz del borde) va dentro de un `InView`**: nada corre fuera de pantalla.
- Barras de "Qué ganas": crecen al entrar con `translateX` dentro de un riel con `overflow-hidden` (no se anima `width`).
- Acordeón de Preguntas: `motion.div` con `initial={false}` y `height: "auto"` (350 ms). Responde a un clic, por eso anima la altura.
- Botones primarios secundarios (barra, menú): clase `btn-sheen`. El CTA principal usa `ShimmerLink`.
- Con `prefers-reduced-motion`: sin desplazamientos ni bucles (el destello y el haz no se montan, el marquee queda quieto), todo visible de inmediato.
