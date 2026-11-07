import { AuthCard } from "@/components/auth/auth-card";
import { NewPasswordForm } from "@/components/auth/reset-forms";

export const metadata = { title: "Nueva contraseña — costea" };

export default function Page() {
  return (
    <AuthCard tagline={["Todo", "listo."]} title="Nueva contraseña" sub="Elige una contraseña de al menos 8 caracteres.">
      <NewPasswordForm />
    </AuthCard>
  );
}