import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ClosingCta() {
  return (
    <section className="bg-brand-900 py-20 text-center sm:py-24">
      <div className="mx-auto max-w-2xl px-5">
        <h2 className="font-brand text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Empieza a costear tu carta hoy.
        </h2>
        <p className="mt-4 text-brand-200">Crea tu cuenta y registra tu primer plato.</p>
        <Link
          href="/registro"
          className={cn(buttonVariants(), "mt-8 h-12 rounded-xl bg-lime-500 px-7 text-base font-semibold text-brand-900 hover:bg-lime-400")}
        >
          Crear mi cuenta
        </Link>
      </div>
    </section>
  );
}
