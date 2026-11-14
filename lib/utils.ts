import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * tailwind-merge con los tokens propios de globals.css. Sin esto, `text-body` se toma por un color y se
 * descarta al combinarlo con `text-ink` (y al revés). Mantener al día con el @theme de app/globals.css.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["body", "small", "caption"],
      tracking: ["display", "title", "label", "overline"],
      leading: ["display"],
      radius: ["5xl"],
      spacing: ["sidebar"],
      shadow: ["soft", "lift", "float"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Foco visible con teclado (DESIGN.md §6) para enlaces y botones sin borde propio.
 * `focusRing` sobre fondos claros; `focusRingDark` sobre brand-900 (menú lateral, Planes, cierre).
 */
export const focusRing = "outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
export const focusRingDark = "outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
