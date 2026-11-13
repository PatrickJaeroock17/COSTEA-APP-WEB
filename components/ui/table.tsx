import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Tablas de costea (DESIGN.md §8). Van dentro de una `Card` de la app; el contenedor
 * desplaza en horizontal en móvil (pasar `min-w-[…]` a `Table` si hace falta).
 * Números: `TableCell numeric` / `TableHead numeric` (a la derecha y con tabular-nums).
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table data-slot="table" className={cn("w-full caption-bottom text-sm text-ink", className)} {...props} />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-line [&_tr]:hover:bg-transparent", className)} {...props} />
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t border-line font-bold tabular-nums [&>tr]:last:border-b-0", className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-line-soft transition-colors hover:bg-surface/60 has-aria-expanded:bg-surface/60 data-[state=selected]:bg-brand-50",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, numeric, ...props }: React.ComponentProps<"th"> & { numeric?: boolean }) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "px-4 py-3 text-left align-middle text-xs font-extrabold tracking-[0.06em] whitespace-nowrap text-muted-foreground uppercase",
        numeric && "text-right",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, numeric, ...props }: React.ComponentProps<"td"> & { numeric?: boolean }) {
  return (
    <td
      data-slot="table-cell"
      className={cn("px-4 py-3 align-middle", numeric && "text-right tabular-nums", className)}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption data-slot="table-caption" className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
}

/** Valor faltante en una celda. */
function TableEmpty() {
  return <span className="text-muted-foreground">—</span>
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption, TableEmpty }
