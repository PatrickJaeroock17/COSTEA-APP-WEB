import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Botones de costea (DESIGN.md §6).
 * - `cta`: píldora verde con círculo lima; la acción principal de la vista (una por vista).
 * - `cta-lime`: la misma píldora invertida, para fondos brand-900.
 * - `shape="pill"` en la landing; `shape="rect"` (por defecto) en la app y el acceso.
 * Para enlaces: `<Link className={buttonVariants({ ... })}>` y, si es CTA, `<CtaArrow />` al final.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 border border-transparent bg-clip-padding font-extrabold whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] duration-150 outline-none select-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/15 active:not-aria-[haspopup]:scale-[0.98] motion-reduce:active:not-aria-[haspopup]:scale-100 disabled:pointer-events-none disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/15 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-brand-700",
        cta: "justify-between gap-6 bg-primary text-primary-foreground hover:bg-brand-700",
        "cta-lime": "justify-between gap-6 bg-lime-500 text-brand-900 hover:bg-lime-400",
        outline: "border-line bg-white text-primary hover:bg-brand-50 aria-expanded:bg-brand-50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-brand-100 aria-expanded:bg-brand-100",
        ghost: "font-bold text-ink hover:bg-surface aria-expanded:bg-surface",
        destructive:
          "bg-danger-soft text-danger-text hover:bg-danger-soft-hover focus-visible:border-danger focus-visible:ring-danger/15",
        link: "h-auto px-0 font-bold text-primary underline-offset-4 hover:underline",
      },
      shape: {
        rect: "rounded-xl",
        pill: "rounded-full",
      },
      size: {
        default: "h-10 px-4 text-[15px]",
        sm: "h-9 px-3 text-sm",
        lg: "h-12 px-6 text-[15px]",
        xl: "min-h-14 px-7 text-base",
        icon: "size-11 [&_svg:not([class*='size-'])]:size-5",
        "icon-sm": "size-9",
      },
    },
    compoundVariants: [
      // El CTA siempre es píldora de 56 px, sea cual sea el tamaño pedido (va después de size para ganarle).
      { variant: "cta", className: "h-auto min-h-14 rounded-full pl-6 pr-2 text-base" },
      { variant: "cta-lime", className: "h-auto min-h-14 rounded-full pl-7 pr-2 text-base" },
      // Píldora secundaria de la landing: borde verde y fondo translúcido sobre crema.
      { variant: "outline", shape: "pill", className: "border-[1.5px] border-primary bg-white/60 hover:bg-white/85" },
      { variant: "link", className: "h-auto px-0" },
    ],
    defaultVariants: {
      variant: "default",
      shape: "rect",
      size: "default",
    },
  }
)

/** Círculo con flecha del CTA. `tone="lime"` para la píldora verde; `tone="dark"` para la píldora lima. */
function CtaArrow({ tone = "lime", className }: { tone?: "lime" | "dark"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full",
        tone === "lime" ? "bg-lime-500 text-brand-900" : "bg-brand-900 text-lime-500",
        className
      )}
    >
      <ArrowUpRight className="size-5" strokeWidth={2.4} />
    </span>
  )
}

function Button({
  className,
  variant = "default",
  shape = "rect",
  size = "default",
  children,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  const cta = variant === "cta" || variant === "cta-lime"
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, shape, size, className }))}
      {...props}
    >
      {children}
      {cta && <CtaArrow tone={variant === "cta" ? "lime" : "dark"} />}
    </ButtonPrimitive>
  )
}

export { Button, CtaArrow, buttonVariants }
