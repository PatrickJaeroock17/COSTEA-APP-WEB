import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/lib/utils"

/** Clases de campo (DESIGN.md §9), también para select y textarea nativos. */
const fieldClass =
  "w-full min-w-0 rounded-xl border border-transparent bg-field px-4 text-[15px] text-ink transition-colors outline-none placeholder:text-subtle focus-visible:border-ring focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-ring/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:bg-white aria-invalid:ring-danger/15 aria-invalid:focus-visible:ring-4"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        fieldClass,
        "h-12 file:mr-3 file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-sm file:font-bold file:text-ink",
        className
      )}
      {...props}
    />
  )
}

export { Input, fieldClass }
