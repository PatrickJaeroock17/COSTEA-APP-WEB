import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Iniciar sesión — costea" };

export default function Page() {
  return <AuthForm mode="login" />;
}

