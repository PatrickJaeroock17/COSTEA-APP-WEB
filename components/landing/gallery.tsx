import { LoopVideo, Photo, Tint } from "@/components/landing/media";
import { container, mediaFrame } from "@/components/landing/styles";
import { cn } from "@/lib/utils";
import emplatado from "@/public/media/galeria-emplatado.jpg";
import limonPoster from "@/public/media/galeria-limon-poster.jpg";
import limones from "@/public/media/galeria-limones.jpg";
import lomo from "@/public/media/galeria-lomo-saltado.jpg";

/**
 * Tira de cocina real entre "Qué incluye" y "Cómo funciona": tres fotos y un video corto, sin texto.
 * Son imágenes ilustrativas de stock (créditos en `public/media/CREDITOS.md`); no llevan pie de foto.
 * Móvil: rejilla de 2 columnas. Escritorio: una fila de anchos distintos con las piezas alternas más bajas.
 */
export function Gallery() {
  return (
    <section aria-label="La cocina de un restaurante, en imágenes" className="relative py-section">
      <div className={cn(container, "grid grid-cols-2 gap-3 md:grid-cols-[1.05fr_1.7fr_0.8fr_1.15fr] md:items-end")}>
        <Photo
          src={lomo}
          alt="Lomo saltado con cebolla y tomate en un plato de cerámica azul"
          sizes="(min-width: 768px) 22vw, 50vw"
          tint="soft"
          shift={12}
          className="aspect-[3/4] md:aspect-auto md:h-80"
        />
        <Photo
          src={emplatado}
          alt="Una mano sirve salsa con un cucharón sobre platos alineados en el pase de la cocina"
          sizes="(min-width: 768px) 36vw, 100vw"
          tint="soft"
          className="order-first col-span-2 aspect-[16/10] md:order-none md:col-span-1 md:aspect-auto md:h-[26rem]"
        />
        <LoopVideo
          mp4="/media/galeria-limon.mp4"
          webm="/media/galeria-limon.webm"
          poster={limonPoster}
          posterSrc="/media/galeria-limon-poster.jpg"
          alt="Manos exprimen un limón sobre un bol de vidrio"
          sizes="(min-width: 768px) 17vw, 50vw"
          className={cn(mediaFrame, "aspect-[3/4] md:aspect-auto md:h-[22rem]")}
        >
          <Tint tone="soft" />
        </LoopVideo>
        <Photo
          src={limones}
          alt="Limones verdes frescos apilados"
          sizes="(min-width: 768px) 24vw, 100vw"
          tint="soft"
          shift={12}
          className="col-span-2 aspect-[16/9] md:col-span-1 md:aspect-auto md:h-[19rem]"
        />
      </div>
    </section>
  );
}
