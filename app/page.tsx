import { Benefits } from "@/components/landing/benefits";
import { ClosingCta } from "@/components/landing/closing-cta";
import { Faq } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { Gallery } from "@/components/landing/gallery";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ProofStrip } from "@/components/landing/proof-strip";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";

export default function Home() {
  return (
    // Una sola página continua: el mismo fondo de principio a fin (DESIGN.md §13).
    <div className="relative isolate w-full flex-1 overflow-x-clip bg-surface-page">
      <SiteHeader />
      <main>
        <Hero />
        <ProofStrip />
        <Features />
        <Gallery />
        <HowItWorks />
        <Benefits />
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}
