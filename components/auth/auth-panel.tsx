import { Logo } from "@/components/brand/logo";

const pills = ["Costo por plato", "Precios con IGV", "Presupuestos"];

/** Panel verde de la izquierda en /ingresar y /registro (solo escritorio). */
export function AuthPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-[#032a1f] lg:flex lg:flex-col lg:justify-between lg:p-14 xl:p-16">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-32 size-[420px] rounded-full bg-[#0d4332]" />
      <div aria-hidden className="pointer-events-none absolute bottom-16 left-[260px] size-[130px] rounded-full bg-[#234a26]" />
      <Logo variant="dark" className="relative" />

      <div className="relative max-w-xl">
        <h2 className="font-brand text-[clamp(34px,3.6vw,52px)] font-extrabold leading-[1.06] tracking-[-0.025em] text-white">
          Deja de adivinar el precio de tus platos.
        </h2>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-[#cfe3da]">
          Costea reúne insumos, recetas, personal y gastos de tu restaurante para calcular costos, precios y presupuestos en un solo lugar.
        </p>
        <ul className="mt-8 flex flex-wrap gap-3">
          {pills.map((p) => (
            <li key={p} className="rounded-full bg-[#14492f] px-4 py-2 text-sm font-bold text-[#d8ee9c]">{p}</li>
          ))}
        </ul>
      </div>

      <div className="relative w-[280px] rounded-[24px] bg-white p-6 shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
        <p className="text-sm font-medium text-[#5b6b65]">Margen operativo (ejemplo)</p>
        <p className="font-brand text-4xl font-extrabold text-[#006b4b]">30 %</p>
        <div className="mt-3 flex h-12 items-end gap-2" aria-hidden>
          {[30, 50, 68, 100].map((h, i) => (
            <span key={h} style={{ height: `${h}%` }} className={["w-4 rounded-sm bg-[#b9e0cd]", "w-4 rounded-sm bg-[#7fc6a4]", "w-4 rounded-sm bg-[#33a879]", "w-4 rounded-sm bg-[#006b4b]"][i]} />
          ))}
        </div>
      </div>
    </aside>
  );
}
