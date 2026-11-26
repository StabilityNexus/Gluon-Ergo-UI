/**
 * @file index.tsx
 * @description Swap page assembling NetworkGuard, ReactorHealth, AdjustPegPanel, and ReactorSwap within PageLayout.
 * @module pages/swap
 */

import PageLayout from "../layout";
import { ReactorSwap } from "@/lib/components/blockchain/swap/ReactorSwap";
import { ReactorHealth } from "@/lib/components/blockchain/reactor/ReactorHealth";
import { AdjustPegPanel } from "@/lib/components/blockchain/reactor/AdjustPegPanel";
import { NetworkGuard } from "@/lib/components/blockchain/reactor/NetworkGuard";
import { SEO } from "@/lib/components/layout/SEO";
import { tokenConfig } from "@/config/tokenConfig";
import { useGluon } from "@/lib/hooks/useGluon";
import { useNetworkGuard } from "@/lib/hooks/useNetworkGuard";

export default function SwapPage() {
  const { snapshot, deployment, status, error } = useGluon();
  const { status: networkStatus, blocked: networkBlocked } = useNetworkGuard();

  return (
    <>
      <SEO
        title="Gluon Reactor | Swap"
        description={`Swap between ERG, ${tokenConfig.stableAsset.symbol}, and ${tokenConfig.volatileAsset.symbol} tokens seamlessly with Gluon's decentralized exchange. Experience fast, secure, and efficient token swaps on the Ergo blockchain.`}
        keywords={`Gluon Swap, Token Exchange, ERG to ${tokenConfig.stableAsset.symbol}, ${tokenConfig.stableAsset.symbol} to ${tokenConfig.volatileAsset.symbol}, DeFi Trading, Ergo DEX, Decentralized Exchange`}
      />
      <PageLayout>
        <div className="flex w-full flex-col gap-6">
          <NetworkGuard status={networkStatus} />
          <ReactorHealth
            snapshot={snapshot}
            deployment={deployment}
            status={status}
            error={error}
          />
          <AdjustPegPanel networkBlocked={networkBlocked} />
          <ReactorSwap networkBlocked={networkBlocked} />
        </div>
      </PageLayout>
    </>
  );
}
