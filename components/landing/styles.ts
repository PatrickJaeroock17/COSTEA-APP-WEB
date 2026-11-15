/** Clases compartidas de la landing (DESIGN.md §13). */

/** Contenedor: el mismo ancho para la barra, el marco de la portada, las secciones y el pie. */
export const container = "mx-auto w-full max-w-7xl px-4 sm:px-6";

/** Sección: padding vertical único y ancla que no queda bajo la barra fija. `relative` para los fondos decorativos. */
export const section = "relative scroll-mt-nav py-section";

/** Tarjeta clara: blanco que cae a un gris casi blanco, borde fino y sombra en capas con filo de luz. */
export const card = "relative overflow-hidden rounded-3xl border border-line bg-linear-to-b from-white to-surface-page shadow-card";

/** Tarjeta o bloque oscuro: brand-900 con degradado radial verde/lima, borde con brillo sutil. */
export const cardDark = "surface-dark relative overflow-hidden rounded-3xl border border-white/10 text-white shadow-dark";

/** Panel interno de una tarjeta clara (demos y vistas previas). */
export const panel = "rounded-2xl border border-line-soft bg-surface-page";

/** Insignia de icono: 56 px, degradado verde, filo de luz. El icono va en `size-7`. */
export const iconBadge =
  "grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-badge ring-1 ring-inset ring-white/20 [&_svg]:size-7";

/** La misma insignia sobre bloques oscuros: lima con icono verde oscuro. */
export const iconBadgeLime =
  "grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-lime-300 to-lime-500 text-brand-900 shadow-badge ring-1 ring-inset ring-white/40 [&_svg]:size-7";
