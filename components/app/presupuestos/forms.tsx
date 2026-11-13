"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Archive, ArchiveRestore, FileCheck2, Loader2 } from "lucide-react";
import { FormAlert } from "@/components/app/form";
import { buttonVariants } from "@/components/ui/button";
import { type BudgetState, publishBudget, setBudgetArchived } from "@/lib/actions/budgets";

function Submit({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "ghost" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonVariants({ variant, size: variant === "default" ? "lg" : "sm" })}>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/**
 * Publicar el plan como presupuesto. Solo se habilita con cálculo completo y revisado; la confirmación
 * explica que el presupuesto queda fijo y que se descuentan los insumos del kardex.
 */
export function PublishBudget({ planId, fingerprint, blocked }: { planId: number; fingerprint: string; blocked: string | null }) {
  const [state, action] = useActionState<BudgetState, FormData>(publishBudget, {});
  const [confirm, setConfirm] = useState(false);
  if (blocked) {
    return (
      <div className="space-y-2">
        <button type="button" disabled className={buttonVariants({ size: "lg" })}>
          <FileCheck2 aria-hidden />
          Publicar presupuesto
        </button>
        <p className="text-sm text-muted-foreground">{blocked}</p>
      </div>
    );
  }
  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} className={buttonVariants({ size: "lg" })}>
        <FileCheck2 aria-hidden />
        Publicar presupuesto
      </button>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-2xl bg-surface p-4">
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="fingerprint" value={fingerprint} />
      <p className="text-sm text-ink">
        El presupuesto queda <strong>fijo</strong>: si luego cambias el plan, publicarás una versión nueva. La primera publicación del plan descuenta del kardex los insumos de
        todas sus porciones a la fecha de referencia, si hay stock suficiente.
      </p>
      <div className="flex flex-wrap gap-2">
        <Submit>Sí, publicar</Submit>
        <button type="button" onClick={() => setConfirm(false)} className={buttonVariants({ variant: "ghost", size: "lg" })}>
          Cancelar
        </button>
      </div>
      <FormAlert error={state.error} />
    </form>
  );
}

export function ArchiveBudget({ budgetId, archived }: { budgetId: number; archived: boolean }) {
  return (
    <form action={setBudgetArchived}>
      <input type="hidden" name="budgetId" value={budgetId} />
      <input type="hidden" name="state" value={archived ? "published" : "archived"} />
      <Submit variant={archived ? "secondary" : "ghost"}>
        {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
        {archived ? "Volver a mostrar" : "Archivar"}
      </Submit>
    </form>
  );
}
