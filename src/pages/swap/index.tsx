import ReactorLayout from "../layout";
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
      <ReactorLayout>
        <div className="mx-auto w-full max-w-7xl rounded-2xl border border-border/50 bg-card/30 px-4 py-8 shadow-lg backdrop-blur-sm sm:px-6 lg:px-8">
          <ReactorSwap />
        </div>
      </ReactorLayout>
    </>
  );
}
