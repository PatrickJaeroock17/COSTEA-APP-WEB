import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Iniciar sesión — costea" };

export default function Page() {
  return (
    <AuthCard tagline={["Costea.", "Ajusta.", "Gana."]} title="Bienvenido de nuevo" sub="Ingresa tu correo y contraseña para continuar con tu restaurante.">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}