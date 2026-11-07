import { AuthCard } from "@/components/auth/auth-card";
import { RequestResetForm } from "@/components/auth/reset-forms";

export const metadata = { title: "Recuperar contraseña — costea" };

export default function Page() {
  return (
    <AuthCard tagline={["Sin", "estrés."]} title="Recupera tu acceso" sub="Te enviaremos un enlace para crear una nueva contraseña.">
      <RequestResetForm />
    </AuthCard>
  );
}