# DESIGN.md — reglas visuales de costea

Fuente de verdad visual para **landing (`/`), acceso (`/ingresar`, `/registro`, `/recuperar`, `/nueva-clave`) y app (`/app/...`)**.
Los tres usan **el mismo tema**: los tokens de marca de `brand/costea-tokens.css` mapeados a las variables de shadcn en `app/globals.css`.
Si este archivo y el código no coinciden, manda este archivo (o se actualiza aquí primero).

Principios: **cálido, claro, redondeado, sobrio**. Mucho espacio en blanco, tarjetas suaves, verde de marca como color de acción y lima solo como acento.
Nada de degradados morados/arcoíris, sombras exageradas, brillos ni "glassmorphism" genérico.

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

### Crema (landing y acceso)
| Token | Hex | Uso |
|---|---|---|
| `cream-50` | `#faf3e0` | Paneles internos de tarjetas de la landing (demos, vistas previas) |
| `cream-100` | `#faefd5` | Secciones claras de la landing (Qué incluye, Qué ganas, Preguntas, pie) |
| **`cream-200`** | **`#f4e6c9`** | **Crema de la portada** (debe coincidir con los cuadros del chef), Cómo funciona, fondo del acceso |
| `cream-300` | `#ead9b3` | Bordes y separadores sobre crema, serie "presupuesto" en gráficos |

La app (`/app`) no usa crema: usa `surface`.

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
| `field` | `#f2f5f3` | Fondo de inputs en reposo |
| `surface` | `#f6f9f7` | Fondo de la app, hover de filas y botones fantasma |
| `white` | `#ffffff` | Tarjetas, popovers, diálogos |

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

---

## 2. Tipografía

| Familia | Variable | Pesos | Para |
|---|---|---|---|
| **Nunito** | `--font-nunito` → `font-brand` / `font-heading` | 700, 800 | Palabra "costea", h1–h3, títulos de tarjeta, cifras KPI |
| **Plus Jakarta Sans** | `--font-jakarta` → `font-sans` | 400–800 | Todo lo demás: texto, botones, formularios, tablas, menú |

Escala:
| Rol | Clases |
|---|---|
| Display (portada) | `font-brand font-extrabold text-[33px] md:text-[clamp(40px,4.6vw,62px)] leading-[1.04] tracking-[-0.025em]` |
| H2 sección landing | `font-brand font-extrabold text-4xl sm:text-5xl leading-[1.05] tracking-[-0.025em]` |
| H1 de módulo (app) / título de acceso | `font-brand font-extrabold text-3xl sm:text-4xl tracking-[-0.02em]` |
| H3 tarjeta | `font-brand font-extrabold text-lg` / `text-xl` |
| Cifra KPI | `font-brand font-extrabold text-2xl`–`text-4xl tabular-nums` |
| Lead | `text-lg leading-relaxed text-ink-soft` (landing) |
| Cuerpo | `text-[15px]`/`text-base`, `leading-relaxed` |
| Pequeño | `text-sm` (14) / `text-[13px]` |
| Rótulo / cabecera de tabla | `text-xs font-extrabold uppercase tracking-[0.06em] text-muted-foreground` |
| Etiqueta tipo píldora | `text-[13px] font-bold text-brand-700 bg-white/70 rounded-full px-3.5 py-[7px]` |

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
| **`rounded-3xl`** | **24 px** | **Tarjetas de la app**, ítems de acordeón/pasos de la landing |
| `rounded-4xl` | 28 px | Tarjetas grandes de la landing, diálogos |
| `rounded-[32px]` | 32 px | Contenedor de acceso y bloque de cierre (solo esos dos) |
| `rounded-full` | — | Píldoras: botones de landing, chips, avatares, insignias |

---

## 4. Sombras

Solo tres niveles, todos tintados con `brand-900` (`rgb(3 42 31)`), nunca negro puro:

| Token | Valor | Para |
|---|---|---|
| `shadow-soft` | `0 10px 30px rgb(3 42 31 / 0.06)` | Tarjetas de la landing en reposo |
| `shadow-lift` | `0 18px 40px rgb(3 42 31 / 0.12)` | Hover de tarjetas, paso/pregunta activa, menús desplegables, popovers |
| `shadow-float` | `0 24px 60px rgb(3 42 31 / 0.18)` | Diálogos, contenedor de acceso, tarjetas flotantes del hero |

Prohibido: opacidades > 0.18, `blur` > 60 px, sombras de color (lima/verde brillante), sombras internas decorativas.
En la app las tarjetas van **sin sombra**, solo con borde `line`; la sombra aparece al elevar (menús, diálogos).

Brillos decorativos (`blur-3xl`): solo en la landing, verde o lima, opacidad ≤ 20 %, **máximo uno por sección**. Nunca en la app ni en el acceso.

---

## 5. Espaciado y layout

Base 4 px (escala de Tailwind). Objetivo táctil mínimo **44 px** (`min-h-11`/`size-11`).

| Contexto | Regla |
|---|---|
| Contenedor landing | `mx-auto max-w-7xl px-5 sm:px-8` |
| Sección landing | `py-20 sm:py-28`; rótulo → título `mt-4`; título → contenido `mt-12` |
| Portada | `md:px-16`, alto `min-h-[max(100vh,780px)]` (ver `brand/HERO-REFERENCIA.md`) |
| App: contenido | `px-4 py-8 sm:px-6 lg:px-8 lg:py-10`; menú lateral `w-[280px]`; barra superior `min-h-16` |
| App: entre bloques | `space-y-6` / `gap-6`; entre tarjetas de una rejilla `gap-4` |
| Tarjeta | app `p-5 sm:p-6`; landing `p-6 sm:p-7`; panel interno `p-4` |
| Formulario | campos `space-y-4`; grupos `gap-4` en rejilla de 2 columnas desde `sm` |

Fondos por zona: landing alterna `cream-200` / `cream-100` / `brand-900`; acceso `cream-200`; app `surface`.

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

Reglas: hover = un tono más oscuro (sin `opacity`); foco `ring-4 ring-ring/15 border-ring`; deshabilitado `opacity-60`; cargando = `Loader2` girando a la izquierda del texto. El primario siempre es `brand-600`; `brand-900` no es color de botón sobre fondo claro.
En una misma barra no se mezclan píldoras y rectángulos.

---

## 7. Tarjetas

| Tipo | Clases |
|---|---|
| Tarjeta de app | `rounded-3xl border border-line bg-card` (sin sombra) |
| Tarjeta de landing | `rounded-4xl border border-cream-300/70 bg-white shadow-soft`; hover opcional `-translate-y-1 shadow-lift` |
| Panel interno | `rounded-2xl bg-cream-50` (landing) / `rounded-2xl bg-surface` (app) |
| Tarjeta KPI | tarjeta de app + rótulo `text-sm font-semibold text-muted-foreground` + cifra `font-brand text-3xl font-extrabold tabular-nums text-heading` |
| Mosaico de icono | `size-11 rounded-2xl` · principal `bg-brand-600 text-lime-500` · secundario `bg-brand-50 text-brand-600` |
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
