# Créditos de fotos y videos de la landing

Todos los medios vienen de [Pexels](https://www.pexels.com) y se usan bajo la
[Licencia de Pexels](https://www.pexels.com/license/): uso gratuito, también comercial, con permiso de modificar
y sin atribución obligatoria. No se pueden revender sin modificar ni usarse para dar a entender que las personas
o marcas que aparecen respaldan el producto.

Las fotos son ilustrativas: ninguna muestra clientes de Costea.

Descargados el 15 de noviembre de 2026. Los originales quedan en `medios-fuente/` (fuera del repositorio).

## Fotos

| Archivo | Dónde se usa | Título en Pexels | Autor | Página de origen |
|---|---|---|---|---|
| `paso-1-restaurante.jpg` | Cómo funciona, paso 1 | Tables in an Empty Restaurant | Hernán Santarelli | https://www.pexels.com/photo/tables-in-an-empty-restaurant-11794317/ |
| `paso-2-insumos.jpg` | Cómo funciona, paso 2 | Seafood in Ice | Change C.C | https://www.pexels.com/photo/seafood-in-ice-20810994/ |
| `paso-3-plato.jpg` | Cómo funciona, paso 3 | Delicious Peruvian Ceviche on Rustic Table | Nano Erdozain | https://www.pexels.com/photo/delicious-peruvian-ceviche-on-rustic-table-28448390/ |
| `paso-4-planificacion.jpg` | Cómo funciona, paso 4 | A Calculator on a Notebook | AlphaTradeZone | https://www.pexels.com/photo/a-calculator-on-a-notebook-5833258/ |
| `que-ganas-ceviche.jpg` | Qué ganas | Exquisite Peruvian Ceviche with Seafood Garnish | Nano Erdozain | https://www.pexels.com/photo/exquisite-peruvian-ceviche-with-seafood-garnish-31495671/ |
| `galeria-limones.jpg` | Galería | Vibrant Fresh Green Limes Close-Up | Anderson Martins | https://www.pexels.com/photo/vibrant-fresh-green-limes-close-up-30741626/ |
| `galeria-lomo-saltado.jpg` | Galería | Peruvian Lomo Saltado with Rice in Blue Ceramic Plate | Nano Erdozain | https://www.pexels.com/photo/peruvian-lomo-saltado-with-rice-in-blue-ceramic-plate-28503600/ |
| `galeria-emplatado.jpg` | Galería | Hand with Kitchen Spoon over Plates with Food | Luis Becerra Fotógrafo | https://www.pexels.com/photo/hand-with-kitchen-spoon-over-plates-with-food-15671409/ |

## Videos

| Archivos | Dónde se usa | Título en Pexels | Autor | Página de origen | Recorte |
|---|---|---|---|---|---|
| `cierre-emplatado.mp4`, `.webm`, `-poster.jpg` | Bloque de cierre | Professional Chef Plating a Gourmet Dish | Oğuzhan Kara | https://www.pexels.com/video/professional-chef-plating-a-gourmet-dish-39498949/ | Del segundo 7,0 al 14,8 (solo el plato y las manos), 1280×720, 25 fps, sin audio |
| `galeria-limon.mp4`, `.webm`, `-poster.jpg` | Galería | A Person Squeezing a Lime Juice into a Bowl | RDNE Stock project | https://www.pexels.com/video/a-person-squeezing-a-lime-juice-into-a-bowl-10432015/ | Del segundo 4,5 al 12,5, 540×960, 24 fps, sin audio |

## Cómo se procesaron

- Fotos: `sharp`, ancho 2000 px (horizontales) o 1400 px (verticales), JPEG calidad 80. `next/image` entrega AVIF o WebP al tamaño de cada pantalla.
- Videos: `ffmpeg -an -c:v libx264 -crf 28 -preset slow -movflags +faststart` y `-c:v libvpx-vp9 -crf 38 -b:v 0` para WebM. El póster es el primer cuadro del recorte.
