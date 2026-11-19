import { Suspense } from "react";
import { AppShell, AppShellSkeleton } from "@/components/app/app-shell";
import { canEdit, getAppContext } from "@/lib/auth";
import { getMonthPlanEvaluation } from "@/lib/data/plan";

export const metadata = { title: "costea — Mi restaurante" };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // La sesión se lee en tiempo de petición: va dentro de Suspense (Cache Components).
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <SessionShell>{children}</SessionShell>
    </Suspense>
  );
}

async function SessionShell({ children }: { children: React.ReactNode }) {
  const { user, restaurants, restaurantId, restaurant, periods, periodId } = await getAppContext();
  // Cifras de ejemplo solo mientras el mes no tiene un plan con cálculo completo (mismo plan que Costo y precio).
  const evaluation = restaurant && periodId ? await getMonthPlanEvaluation(restaurant.id, periodId, restaurant.name, restaurant.currency) : null;
  // La insignia solo tiene sentido en el costeo completo: en los niveles 1 y 2 no se muestran cifras de ejemplo.
  const costLevel = restaurant?.costLevel ?? 1;
  const sampleData = costLevel === 3 && evaluation?.result.status !== "calculable";
  return (
    <AppShell
      user={{ name: user.name, email: user.email }}
      restaurants={restaurants}
      restaurantId={restaurantId}
      periods={periods.map((p) => ({ id: p.id, label: p.label }))}
      periodId={periodId}
      sampleData={sampleData}
      costLevel={costLevel}
      canChangeLevel={canEdit(restaurant?.role)}
    >
      {children}
    </AppShell>
  );
}