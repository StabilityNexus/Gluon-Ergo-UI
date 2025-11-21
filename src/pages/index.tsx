import { Features } from "@/lib/components/blocks/home/Features";
import Hero from "@/lib/components/blocks/home/Hero";
import { SEO } from "@/lib/components/layout/SEO";
import PageLayout from "./layout";

export default function Home() {
  return (
    <>
      <SEO
        title="Gluon | Gold-Pegged DeFi on Ergo"
        description="Experience the future of DeFi with Gluon - a stablecoin protocol on offering gold-pegged tokens on the Ergo blockchain."
        keywords="Gluon, Ergo, DeFi, Gold, Stablecoin, Gold-pegged tokens, Cryptocurrency, Blockchain, GAU, GAUC, Digital Gold"
      />
      <PageLayout>
        <div className="mx-auto w-full max-w-7xl space-y-12 rounded-2xl border border-border/50 bg-card/30 px-4 py-8 shadow-lg backdrop-blur-sm sm:px-6 lg:px-8">
          <Hero />
          <Features />
        </div>
      </PageLayout>
    </>
  );
}
