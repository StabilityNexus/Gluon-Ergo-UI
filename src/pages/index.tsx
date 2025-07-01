import { Features } from "@/lib/components/blocks/home/Features";
import Hero from "@/lib/components/blocks/home/Hero";
import { SEO } from "@/lib/components/layout/SEO";

export default function Home() {
  return (
    <>
      <SEO
        title="Gluon | Gold-Backed DeFi on Ergo"
        description="Experience the future of DeFi with Gluon - a revolutionary protocol on Ergo blockchain offering gold-backed tokens, secure swaps, and innovative financial instruments."
        keywords="Gluon, Ergo, DeFi, Gold-backed tokens, Cryptocurrency, Blockchain, GAU, GAUC, Digital Gold"
      />
      <Hero />
      <Features />
    </>
  );
}


