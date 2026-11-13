import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { ConceptForm, ToggleConcept } from "@/components/app/gastos/forms";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { canEdit, getAppContext } from "@/lib/auth";
import { decimalText } from "@/lib/costing/decimal";
import { getConcept, getProductChoices } from "@/lib/data/expenses";

export const metadata = { title: "costea — Gasto" };

type Props = { params: Promise<{ id: string }> };

export default function GastoPage(props: Props) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<div className="h-[480px] animate-pulse rounded-3xl bg-white" aria-busy="true" aria-label="Cargando" />}>
        <Detail {...props} />
      </Suspense>
    </div>
  );
}

async function Detail({ params }: Props) {
  const [{ id }, ctx] = await Promise.all([params, getAppContext()]);
  const r = ctx.restaurant;
  const conceptId = Number(id);
  if (!r || !Number.isInteger(conceptId) || conceptId <= 0) notFound();
  const [concept, products] = await Promise.all([getConcept(r.id, conceptId), getProductChoices(r.id)]);
  if (!concept) notFound();
  const period = ctx.periods.find((p) => p.id === concept.period_id);

  return (
    <>
      <Link href="/app/gastos" className={buttonVariants({ variant: "link" })}>
        <ArrowLeft aria-hidden />
        Gastos
      </Link>
      <h1 className="mt-2 font-brand text-3xl font-extrabold tracking-[-0.02em] text-heading sm:text-4xl">{concept.name}</h1>
      <p className="mt-1 text-muted-foreground">Gasto de {period?.label ?? "otro mes"}</p>
      <Card className="mt-6">
        <CardContent>
          {canEdit(r.role) ? (
            <>
              <ConceptForm
                periodId={concept.period_id}
                periodLabel={period?.label ?? ""}
                currency={r.currency}
                products={products.filter((p) => p.active || concept.targets.includes(p.id))}
                initial={{
                  id: concept.id,
                  name: concept.name,
                  referenceKey: concept.reference_key ?? "",
                  kind: concept.kind,
                  amount: decimalText(concept.amount),
                  behavior: concept.behavior,
                  basis: concept.basis,
                  justification: concept.justification,
                  targets: concept.targets,
                  active: concept.active,
                }}
              />
              <div className="mt-6 border-t border-line pt-4">
                <ToggleConcept conceptId={concept.id} active={concept.active} />
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Solo el dueño o un editor puede modificar gastos.</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
