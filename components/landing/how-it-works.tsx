const steps = [
  { title: "Registra tu restaurante", text: "Crea tu cuenta y elige el mes de trabajo." },
  { title: "Carga insumos, recetas y gastos", text: "Tus ingredientes, tus platos, tu personal y tus gastos del mes." },
  { title: "Mira costos y precios", text: "Costea calcula el costo real de cada plato y el precio con tu margen." },
  { title: "Planea y controla", text: "Arma el plan de producción y el presupuesto, y compáralos con tus ventas." },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="scroll-mt-4 bg-cream py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <h2 className="font-brand text-3xl font-extrabold tracking-tight text-brand-900 sm:text-4xl">Cómo funciona</h2>
        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-[var(--radius-card)] bg-white p-6 shadow-sm shadow-brand-900/5">
              <span className="grid size-10 place-items-center rounded-full bg-brand-600 font-brand text-lg font-bold text-white">{i + 1}</span>
              <h3 className="mt-4 font-semibold text-brand-900">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
