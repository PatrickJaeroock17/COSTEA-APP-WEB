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
      spacing: ["sidebar"],
      shadow: ["soft", "lift", "float"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
