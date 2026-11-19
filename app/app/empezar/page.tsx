import Link from "next/link";
import { Suspense } from "react";
import { CreateRestaurant } from "@/components/app/create-restaurant";
import { StepHeader } from "@/components/app/empezar/steps";
import { ChooseDishView, PriceView, ResultView } from "@/components/app/empezar/views";
import { buttonVariants } from "@/components/ui/button";
import { canEdit, getAppContext } from "@/lib/auth";
import { type CatalogDish, getCatalogDishes, getProductSummaries } from "@/lib/data/products";
import { limaToday } from "@/lib/materials";
import { DEFAULT_FOOD_COST, quickPrice } from "@/lib/quick-price";
import { igvLabel } from "@/lib/restaurants";
import { cn } from "@/lib/utils";

export const metadata = { title: "costea — Tu primer costo" };

type Props = { searchParams: Promise<{ plato?: string; listo?: string }> };

export default function EmpezarPage({ searchParams }: Props) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<div className="h-[420px] animate-pulse rounded-3xl bg-white" aria-busy="true" aria-label="Cargando" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const card = "rounded-3xl border border-line bg-card p-6 sm:p-8";

/** El plato de ejemplo: un ceviche si el catálogo lo tiene; si no, el primero. */
const exampleOf = (dishes: CatalogDish[]) => dishes.find((d) => /ceviche/i.test(d.name)) ?? dishes[0];

async function Content({ searchParams }: Props) {
  const [sp, ctx] = await Promise.all([searchParams, getAppContext()]);
  const r = ctx.restaurant;
  const first = ctx.user.name.split(" ")[0];

  // Paso 1: el restaurante (solo el nombre). El mes de trabajo se crea solo junto con el restaurante.
  if (!r) {
    return (
      <>
        <StepHeader step={1} />
        <CreateRestaurant name={first} />
        <p className="mt-4 text-base text-muted-foreground">Creamos también tu mes de trabajo, para que no tengas que hacerlo tú.</p>
      </>
    );
  }
  if (!canEdit(r.role)) {
    return (
      <div className={card}>
        <h1 className="font-brand text-2xl font-extrabold text-heading">Solo puedes mirar este restaurante</h1>
        <p className="mt-2 text-lg text-ink-soft">Pide al dueño o a un editor que cargue el primer plato.</p>
        <Link href="/app" className={cn(buttonVariants({ size: "lg" }), "mt-6 h-14 px-6 text-lg")}>
          Ir al inicio
        </Link>
      </div>
    );
  }

  const products = (await getProductSummaries(r.id, limaToday())).filter((p) => p.active && p.cost.perUnit);
  const asked = Number(sp.plato);
  const dish = products.find((p) => p.id === asked) ?? [...products].sort((a, b) => b.id - a.id)[0];

  // Paso 2: elegir el primer plato (uno de ejemplo, en un clic).
  if (!dish) {
    const catalog = await getCatalogDishes();
    const example = exampleOf(catalog);
    return <ChooseDishView example={example} others={catalog.filter((d) => d.id !== example?.id)} blocked={r.currency !== "PEN"} />;
  }

  const perUnit = dish.cost.perUnit!.toFixed();
  const money = { currency: r.currency, igvRate: r.igvRate, igvLabel: igvLabel(r.igvRate) };
  const suggested = quickPrice(perUnit, String(DEFAULT_FOOD_COST), r.igvRate);

  // Resultado: ya hay precio de carta.
  if (sp.listo && dish.price) {
    return <ResultView dish={{ id: dish.id, name: dish.name, category: dish.menu_category, perUnit, pending: dish.cost.pricePending, current: dish.price }} money={money} />;
  }

  // Paso 3: el precio de carta, con el sugerido ya escrito.
  return (
    <PriceView
      dishName={dish.name}
      perUnit={perUnit}
      productId={dish.id}
      defaultAmount={dish.price ?? suggested.gross.toFixed(2)}
      suggestedGross={suggested.gross.toFixed(2)}
      money={money}
    />
  );
}
