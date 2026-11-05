import { Check } from "lucide-react";

const gains = [
  "Saber el costo real de cada plato, con insumos, mano de obra y gastos.",
  "Fijar precios con el margen que tú decides, con IGV del 18 % incluido.",
  "Detectar qué platos te dejan más y cuáles te dejan poco.",
  "Planear la producción y las compras de cada mes sin adivinar.",
  "Tener tus números ordenados en un solo lugar, separados por restaurante.",
];

export function Benefits() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <h2 className="font-brand text-3xl font-extrabold tracking-tight text-brand-900 sm:text-4xl">Qué ganas</h2>
        <ul className="space-y-4">
          {gains.map((g) => (
            <li key={g} className="flex gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-lime-500 text-brand-900">
                <Check className="size-4" aria-hidden />
              </span>
              <span className="text-brand-900">{g}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
