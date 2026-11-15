import { Benefits } from "@/components/landing/benefits";
import { ClosingCta } from "@/components/landing/closing-cta";
import { Faq } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Plans } from "@/components/landing/plans";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";

export default function Home() {
  return (
    // Una sola página continua: el mismo fondo de principio a fin (DESIGN.md §13).
    <div className="w-full flex-1 overflow-x-clip bg-surface-page">
      <SiteHeader />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Benefits />
        <Plans />
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}
