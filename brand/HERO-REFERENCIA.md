# Portada (hero) de Costea: especificación exacta

Referencia visual: tablero `Hero3D` del canvas de diseño (1360×780). La portada de la app debe verse y moverse como ese tablero. Si algo de este archivo choca con lo implementado, gana este archivo.

## 1. Composición

- Sección de pantalla completa: `position:relative; width:100%; min-height:780px; overflow:hidden; background:#f4e6c9` (crema cálido, color único de fondo; no usar el blanco de shadcn).
- Capa del chef (detrás de todo, `aria-hidden`): `position:absolute; right:0; top:0; width:78%; height:100%`.
  - Máscara de fundido a la izquierda: `mask-image: linear-gradient(to right, transparent 0%, #000 34%)` (más el prefijo `-webkit-`).
  - El video/canvas usa `width:100%; height:100%; object-fit:cover; object-position:35% 50%`. Sin bordes, sin sombra, sin esquinas redondeadas: el chef se funde con el fondo.
- Contenido (texto) encima: `position:relative; z-index:1/2`, a la izquierda, con `max-width:540px`, padding horizontal 64px.
- Cabecera: logo (símbolo 40px + "costea" Nunito 800, 28px, #006b4b) · nav (Qué incluye, Cómo funciona, Planes, Preguntas; 15px/600; #12251f) · "Iniciar sesión" (texto #006b4b) + botón "Crear cuenta" (fondo #006b4b, texto blanco, radio 12px).

## 2. Texto del hero (columna izquierda, separación 24px)

- Etiqueta: "Costos y presupuestos para restaurantes" · 13px/700 · #00563d · fondo `rgba(255,255,255,.7)` · pill (radio 999px, padding 7×14).
- H1: "Sabe cuánto cuesta cada plato y cuánto te deja." · Nunito 800 · 62px · line-height 1.04 · letter-spacing -.025em · #032a1f.
- Párrafo: 19px · line-height 1.6 · #2c3f38 · max-width 500px.
- Botones: primario "Crear mi cuenta" (#006b4b, blanco, 800, 16px, padding 15×26, radio 14px) y secundario "Ver cómo funciona" (fondo `rgba(255,255,255,.6)`, texto y borde 1.5px #006b4b).
- Nota: "Hecho para restaurantes en Perú · Precios con IGV del 18 %" · 14px · #3f524b.
- Importante: todos los textos con colores explícitos de la paleta. No usar `text-muted` de shadcn (es casi blanco sobre este fondo).

## 3. Tarjetas flotantes (2)

Animación `bob`: `translateY(0) → -8px → 0`, `ease-in-out infinite`; desactivar con `prefers-reduced-motion`.

- Tarjeta blanca: `right:6%; top:30%` · "Costo completo (ejemplo)" 12px/600 #5b6b65 · "S/ 10.00" Nunito 800 24px · radio 16px · padding 12×16 · sombra `0 12px 30px rgba(3,42,31,.18)` · bob 5s.
- Tarjeta verde: `left:49%; bottom:16%` · fondo #006b4b · "Margen (ejemplo)" 12px/600 #d8ee9c · "33 %" Nunito 800 24px blanco · sombra `0 12px 30px rgba(3,42,31,.25)` · bob 5.8s con retraso .6s.
- Pista inferior: `left:64px; bottom:22px` · icono cursor 16px + "Mueve el cursor: el chef te sigue." · 13px · #3f524b.

## 4. Comportamiento del chef (lo más importante)

El video (`brand/costea-chef-scrub.mp4`, 1440×812, 97 cuadros, 4.04 s) está **siempre en pausa**; el cursor controla en qué instante se muestra. Mapa de cuadros: izquierda = inicio, **de frente ≈ 52 % de la duración (~2.1 s)**, derecha = final.

Mapeo cursor → tiempo (el cursor se mide sobre TODA la sección, no solo sobre el chef):

```
x  = clientX - hero.left
cx = hero.width * 0.64          // posición del chef
D  = duración
tf = D * 0.52                   // de frente

si x < cx:  k = clamp(x / cx, 0, 1);            t = 0.02 + (tf - 0.02) * k
si no:      k = clamp((x - cx)/(width - cx),0,1); t = tf + (D - 0.05 - tf) * k
```

Es decir: cursor en el borde izquierdo = chef mirando a la izquierda (t=0.02); cursor sobre el chef (64 % del ancho) = de frente; cursor en el borde derecho = mirando a la derecha (t=D-0.05). Mover el cursor por toda la pantalla recorre todo el giro de forma proporcional y suave. NO limitar el recorrido a unos pocos anchos del chef: eso exagera el movimiento y se siente brusco.

Suavizado: cada cuadro de animación, `cur += (target - cur) * 0.14` (a 60 Hz; si se calcula por tiempo, equivale a `1 - 0.86^(dt*60)`). Es suave y con inercia; no subir a más de ~0.2.

Estado de reposo: al cargar y sin cursor, mostrar el cuadro de frente (`tf`). En móvil, mismo mapeo con `touchmove`.
`prefers-reduced-motion`: solo el cuadro de frente, sin seguimiento ni animación de tarjetas.

## 5. Fluidez (para evitar saltos)

Asignar `video.currentTime` en cada cuadro produce tirones porque el navegador decodifica con retraso. Para que sea fluido como en el tablero de referencia:

- Extraer los cuadros a WebP (1440×812, calidad ~80) en `public/chef/`, precargarlos como `ImageBitmap` y dibujarlos en un `<canvas>` con `drawImage`, redibujando solo cuando cambie el índice entero del cuadro (índice = `cur / D * (n-1)`).
- El canvas debe replicar `object-fit: cover` y `object-position: 35% 50%` (calcular el recorte a mano) y llevar la misma máscara de fundido.
- Cargar primero el cuadro de frente (reposo) y mostrarlo mientras llegan los demás.
- Si el peso total de `public/chef/` pasa de ~6 MB, bajar la calidad o usar uno de cada dos cuadros en móvil.

## 6. Pendientes antes de publicar

- El video actual tiene la marca de agua de KlingAI; usar una exportación sin marca para producción.
- Verificar visualmente con el cursor en los tres puntos: borde izquierdo, sobre el chef, borde derecho.
