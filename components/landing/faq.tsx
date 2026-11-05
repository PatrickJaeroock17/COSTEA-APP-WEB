const faqs = [
  { q: "¿Para qué tipo de negocio sirve?", a: "Para restaurantes y cevicherías que quieren conocer el costo de sus platos y su margen. Los datos y la moneda están pensados para Perú (soles, IGV 18 %)." },
  { q: "¿Puedo manejar más de un restaurante?", a: "Sí. Cada restaurante tiene sus propios datos y tú eliges cuál ver desde el menú superior." },
  { q: "¿Mis datos están separados de los de otros?", a: "Sí. Cada restaurante ve solamente su información." },
  { q: "¿Qué pasa si cambia el precio de un insumo?", a: "Guardamos versiones de precio, así que puedes ver cómo cambió el costo de tus platos en el tiempo." },
  { q: "¿Cuánto cuesta?", a: "Los planes todavía están por definir." },
];

export function Faq() {
  return (
    <section id="preguntas" className="scroll-mt-4 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <h2 className="font-brand text-3xl font-extrabold tracking-tight text-brand-900 sm:text-4xl">Preguntas</h2>
        <div className="mt-10 space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="group rounded-[var(--radius-card)] border border-line bg-surface px-5 py-4 open:bg-white">
              <summary className="cursor-pointer list-none font-semibold text-brand-900 marker:hidden after:float-right after:text-brand-600 after:content-['+'] group-open:after:content-['–']">
                {f.q}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-brand-700">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

