import { Features } from "@/lib/components/blocks/home/Features";
import Hero from "@/lib/components/blocks/home/Hero";
import { SEO } from "@/lib/components/layout/SEO";
import PageLayout from "./layout";
import { tokenConfig, formatPegAsset } from "@/config/tokenConfig";

export default function Home() {
  return (
    <>
      <SEO
        title={`Gluon | ${tokenConfig.peg.type}-Pegged DeFi on Ergo`}
        description={`Experience the future of DeFi with Gluon - a stablecoin protocol offering ${formatPegAsset()}-pegged tokens on the Ergo blockchain.`}
        keywords={`Gluon, Ergo, DeFi, ${tokenConfig.peg.type}, Stablecoin, ${tokenConfig.peg.type}-pegged tokens, Cryptocurrency, Blockchain, ${tokenConfig.stableAsset.symbol}, ${tokenConfig.volatileAsset.symbol}, Digital ${tokenConfig.peg.type}`}
      />
      <PageLayout>
          <Hero />
          <Features />
      </PageLayout>
    </>
  );
}
