/**
 * @file index.tsx
 * @description Reactor dashboard page displaying ReactorHealth, GluonStats, VolumeChart,
 * ProtonAPYBadge, and GluonExplainer driven by GluonProvider.
 * @module pages/reactor
 */
"use client";

import PageLayout from "../layout";
import { GluonStats } from "@/lib/components/blocks/dashboard/GluonStats";
import { ProtonAPYBadge } from "@/lib/components/blocks/dashboard/ProtonAPYBadge";
import { GluonExplainer } from "@/lib/components/blocks/dashboard/GluonExplainer";
import { ReactorHealth } from "@/lib/components/blockchain/reactor/ReactorHealth";
import { SEO } from "@/lib/components/layout/SEO";
import { tokenConfig } from "@/config/tokenConfig";
import { useGluon } from "@/lib/hooks/useGluon";
import { motion } from "framer-motion";

export default function ReactorDashboard() {
  const { snapshot, deployment, status, error } = useGluon();

  return (
    <>
      <SEO
        title="Reactor Dashboard"
        description="Monitor Gluon reactor health, peg prices, reserves, and transmutation volume in real time."
        keywords={`Gluon Dashboard, DeFi Stats, ${tokenConfig.stableAsset.symbol} Price, ${tokenConfig.volatileAsset.symbol} Price, ${tokenConfig.peg.type} Price, Ergo DeFi`}
      />
      <PageLayout>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="space-y-6"
        >
          <ReactorHealth
            snapshot={snapshot}
            deployment={deployment}
            status={status}
            error={error}
          />

          <div className="flex flex-col gap-4">
            <GluonStats />
            <ProtonAPYBadge />
          </div>

          <GluonExplainer />
        </motion.div>
      </PageLayout>
    </>
  );
}
