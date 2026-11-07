import { AppShell } from "@/components/app/app-shell";

export const metadata = { title: "costea — Mi restaurante" };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
