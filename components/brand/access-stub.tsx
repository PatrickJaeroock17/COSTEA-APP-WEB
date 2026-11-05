import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function AccessStub({ title }: { title: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-cream px-5">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] bg-white p-8 text-center shadow-sm">
        <Logo className="justify-center" />
        <h1 className="mt-6 font-brand text-2xl font-extrabold text-brand-900">{title}</h1>
        <p className="mt-2 text-sm text-brand-700">Disponible en la siguiente fase.</p>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-brand-600 hover:underline">Volver al inicio</Link>
      </div>
    </main>
  );
}

