import PageLayout from "../layout";
import { ReactorSwap } from "@/lib/components/blockchain/swap/ReactorSwap";
import { SEO } from "@/lib/components/layout/SEO";

export default function ReactorPage() {
  return (
    <>
      <SEO
        title="Gluon Reactor | Swap"
        description="Swap between ERG, GAU, and GAUC tokens seamlessly with Gluon's decentralized exchange. Experience fast, secure, and efficient token swaps on the Ergo blockchain."
        keywords="Gluon Swap, Token Exchange, ERG to GAU, GAU to GAUC, DeFi Trading, Ergo DEX, Decentralized Exchange"
      />
      <PageLayout>
          <ReactorSwap />
      </PageLayout>
    </>
  );
}
