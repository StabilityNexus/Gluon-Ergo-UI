import { Features } from "@/lib/components/blocks/home/Features";
import Hero from "@/lib/components/blocks/home/Hero";
import { SEO } from "@/lib/components/layout/SEO";

export default function Home() {
  return (
    <>
      <SEO
        title="Gluon | Gold-Pegged Stablecoin on Ergo"
        description="Experience the future of decentralized stablecoins with the Gluon protocol on the Ergo blockchain - mint gold-pegged stablecoins and leveraged volatity yield tokens backed by ERG."
        keywords="Gluon, Ergo, DeFi, Gold-pegged, Stablecoin, Cryptocurrency, Blockchain, GAU, GAUC, Digital Gold, Decentralized Finance, Autonomous, Permissionless, Transparent, Distributed Ledger Technology"
      />
      <Hero />
      <Features />
    </>
  );
}


