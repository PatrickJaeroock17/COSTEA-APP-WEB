import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata = { title: "Crear cuenta — costea" };

export default function Page() {
  return (
    <AuthCard tagline={["Tu carta.", "Tus números."]} title="Crea tu cuenta" sub="Empieza a costear tu restaurante en minutos.">
      <RegisterForm />
    </AuthCard>
  );
}