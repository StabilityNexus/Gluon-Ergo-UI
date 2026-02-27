import PageLayout from "../layout";
import { ReactorSwap } from "@/lib/components/blockchain/swap/ReactorSwap";
import { SEO } from "@/lib/components/layout/SEO";
import { tokenConfig } from "@/config/tokenConfig";

export default function ReactorPage() {
  return (
    <>
      <SEO
        title="Gluon Reactor | Swap"
        description={`Swap between ERG, ${tokenConfig.stableAsset.symbol}, and ${tokenConfig.volatileAsset.symbol} tokens seamlessly with Gluon's decentralized exchange. Experience fast, secure, and efficient token swaps on the Ergo blockchain.`}
        keywords={`Gluon Swap, Token Exchange, ERG to ${tokenConfig.stableAsset.symbol}, ${tokenConfig.stableAsset.symbol} to ${tokenConfig.volatileAsset.symbol}, DeFi Trading, Ergo DEX, Decentralized Exchange`}
      />
      <PageLayout>
          <ReactorSwap />
      </PageLayout>
    </>
  );
}
