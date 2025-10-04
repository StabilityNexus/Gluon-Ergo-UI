import { Features } from "@/lib/components/blocks/home/Features";
import Hero from "@/lib/components/blocks/home/Hero";
import { SEO } from "@/lib/components/layout/SEO";

export default function Home() {
  return (
    <>
      <SEO
        title="Gluon | Gold-Pegged DeFi on Ergo"
        description="Experience the future of DeFi with Gluon - a stablecoin protocol on offering gold-pegged tokens on the Ergo blockchain."
        keywords="Gluon, Ergo, DeFi, Gold, Stablecoin, Gold-pegged tokens, Cryptocurrency, Blockchain, GAU, GAUC, Digital Gold"
      />
      <Hero />
      <Features />
    </>
  );
}
