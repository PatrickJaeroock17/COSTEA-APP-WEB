import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Tarjetas de costea (DESIGN.md §7).
 * - `app` (por defecto): radio 24 px, borde `line`, sin sombra.
 * - `landing`: radio 28 px, borde crema y sombra suave.
 * - `dark`: superficie brand-900 con los radios de la app.
 */
type CardVariant = "app" | "landing" | "dark"

const cardVariants: Record<CardVariant, string> = {
  app: "rounded-3xl border border-line bg-card text-card-foreground",
  landing: "rounded-4xl border border-cream-300/70 bg-white text-card-foreground shadow-soft",
  dark: "rounded-3xl bg-brand-900 text-white",
}

function Card({
  className,
  variant = "app",
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { variant?: CardVariant; size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-variant={variant}
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-4 overflow-hidden py-(--card-spacing) [--card-spacing:--spacing(5)] sm:[--card-spacing:--spacing(6)] data-[size=sm]:[--card-spacing:--spacing(4)] data-[variant=landing]:sm:[--card-spacing:--spacing(7)] has-data-[slot=card-footer]:pb-0",
        cardVariants[variant],
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min items-start gap-1 px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-lg leading-snug font-extrabold text-heading group-data-[variant=dark]/card:text-white group-data-[size=sm]/card:text-base",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm leading-relaxed text-muted-foreground group-data-[variant=dark]/card:text-sidebar-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-(--card-spacing)", className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-2 border-t border-line bg-surface/60 p-(--card-spacing)", className)}
      {...props}
    />
  )
}

/** Panel interno de una tarjeta: crema en la landing, `surface` en la app. */
function CardPanel({ className, tone = "app", ...props }: React.ComponentProps<"div"> & { tone?: "app" | "landing" }) {
  return (
    <div
      data-slot="card-panel"
      className={cn("rounded-2xl p-4", tone === "landing" ? "bg-cream-50" : "bg-surface", className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent, CardPanel }
