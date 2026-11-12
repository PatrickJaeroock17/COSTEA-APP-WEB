import { Suspense } from "react";
import { AppShell, AppShellSkeleton } from "@/components/app/app-shell";
import { getAppContext } from "@/lib/auth";

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
  const { user, restaurants, restaurantId, periods, periodId } = await getAppContext();
  return (
    <AppShell
      user={{ name: user.name, email: user.email }}
      restaurants={restaurants}
      restaurantId={restaurantId}
      periods={periods.map((p) => ({ id: p.id, label: p.label }))}
      periodId={periodId}
    >
      {children}
    </AppShell>
  );
}