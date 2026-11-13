import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, FileCheck2 } from "lucide-react";
import { CreateRestaurant } from "@/components/app/create-restaurant";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAppContext } from "@/lib/auth";
import { getBudgets } from "@/lib/data/budgets";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "costea — Presupuestos" };

type Props = { searchParams: Promise<{ estado?: string }> };

export default function PresupuestosPage({ searchParams }: Props) {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<div className="h-[480px] animate-pulse rounded-3xl bg-white" aria-busy="true" aria-label="Cargando" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: Props) {
  const [sp, ctx] = await Promise.all([searchParams, getAppContext()]);
  if (!ctx.restaurant) return <CreateRestaurant name={ctx.user.name.split(" ")[0]} />;
  const archived = sp.estado === "archivados";
  const budgets = await getBudgets(ctx.restaurant.id);
  const shown = budgets.filter((b) => b.archived === archived);
  const periodLabel = new Map(ctx.periods.map((p) => [p.id, p.label]));

  return (
    <>
      <PageHeader
        icon={FileCheck2}
        title="Presupuestos"
        text="Cada presupuesto es la fotografía fija de un plan publicado: costos, precios, ventas y utilidad tal como estaban. Se publican desde Plan de producción."
      >
        <Link href="/app/plan" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Ir a Plan de producción
        </Link>
      </PageHeader>

      <div className="mt-6 flex gap-2 text-sm">
        {[
          { href: "/app/presupuestos", label: "Publicados", on: !archived },
          { href: "/app/presupuestos?estado=archivados", label: "Archivados", on: archived },
        ].map((t) => (
          <Link key={t.label} href={t.href} aria-current={t.on ? "page" : undefined} className={cn("rounded-full px-3 py-1.5 font-bold", t.on ? "bg-brand-100 text-brand-700" : "text-muted-foreground hover:bg-white")}>
            {t.label}
          </Link>
        ))}
      </div>

      <div className="mt-4">
        {!shown.length ? (
          <EmptyState
            title={archived ? "No hay presupuestos archivados" : "Aún no publicas presupuestos"}
            text={archived ? undefined : "Cuando un plan tenga el cálculo completo y revisado, publícalo desde su ficha en Plan de producción."}
          />
        ) : (
          <Card>
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Mes</TableHead>
                  <TableHead numeric>Versión</TableHead>
                  <TableHead>Publicado</TableHead>
                  <TableHead className="sr-only">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Link href={`/app/presupuestos/${b.id}`} className="font-bold text-heading hover:underline">
                        {b.plan?.name ?? `Plan #${b.plan_id}`}
                      </Link>
                    </TableCell>
                    <TableCell>{b.plan ? (periodLabel.get(b.plan.period_id) ?? "—") : "—"}</TableCell>
                    <TableCell numeric>v{b.number}</TableCell>
                    <TableCell>{formatDate(b.created_at)}</TableCell>
                    <TableCell>
                      <Link href={`/app/presupuestos/${b.id}`} aria-label={`Ver presupuesto ${b.number}`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })}>
                        <ChevronRight aria-hidden />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </>
  );
}
