"use client";

import { useEffect, useState } from "react";
import { GluonStats } from "@/lib/components/blocks/dashboard/GluonStats";
import PageLayout from "../layout";
import { MyStats } from "@/lib/components/blocks/dashboard/MyStats";
import { ReserveRatioChart } from "@/lib/components/blocks/dashboard/ReserveRatioChart";
import { GaucYieldChart } from "@/lib/components/blocks/dashboard/GaucYieldChart";
import { GaucLeverageChart } from "@/lib/components/blocks/dashboard/GaucLeverageChart";
import { CumulativeFeesChart } from "@/lib/components/blocks/dashboard/CumulativeFeesChart";
import { SEO } from "@/lib/components/layout/SEO";
import { tokenConfig } from "@/config/tokenConfig";
import { motion } from "framer-motion";

interface OracleData {
  goldPriceNanoErg: number;
  totalNeutronSupply: number;
  currentLeverage: number;
}

export default function ReactorDashboard() {
  const [oracle, setOracle] = useState<OracleData | null>(null);
  const [oracleLoading, setOracleLoading] = useState(true);
  const [oracleError, setOracleError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchOracle() {
      setOracleLoading(true);
      setOracleError(null);
      try {
        const sdk = await import("gluon-ergo-sdk");
        const gluon = new sdk.Gluon();
        gluon.config.NETWORK = process.env.NEXT_PUBLIC_DEPLOYMENT || "testnet";
        gluon.config.NODE_URL = process.env.NEXT_PUBLIC_NODE_URL || "https://node.ergopool.io/";
        const [gluonBox, oracleBox] = await Promise.all([
          gluon.getGluonBox(),
          gluon.getOracleBox(),
        ]);
        const [goldPriceRaw, totalSupply, normalizedRatio] = await Promise.all([
          oracleBox.getPrice(),
          gluonBox.getTotalSupply(),
          gluon.getReserveRatio(gluonBox, oracleBox),
        ]);
        const goldPriceNanoErg = Number(goldPriceRaw);
        const totalNeutronSupply = Number(totalSupply[0]);
        // Exactly as GluonStats.tsx line 130
        const currentLeverage = Math.round(-(100 / (100 - normalizedRatio)) * 100) / 100;

        if (!cancelled) {
          setOracle({
            goldPriceNanoErg,
            totalNeutronSupply,
            currentLeverage,
          });
          setOracleLoading(false);
        }
      } catch (err: any) {
        console.warn("[ReactorDashboard] Oracle fetch failed:", err);
        if (!cancelled) {
          setOracleError(err?.message || "Failed to fetch live oracle data");
          setOracleLoading(false);
        }
      }
    }
    fetchOracle();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <SEO
        title="Reactor Dashboard"
        description="Monitor your Gluon portfolio, track token prices, and analyze market statistics in real-time with our comprehensive DeFi dashboard."
        keywords={`Gluon Dashboard, DeFi Stats, ${tokenConfig.stableAsset.symbol} Price, ${tokenConfig.volatileAsset.symbol} Price, ${tokenConfig.peg.type} Price, Portfolio Tracker, Ergo DeFi`}
      />
      <PageLayout>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: "easeOut" }}>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}>
            <GluonStats />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
            <MyStats />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5 }}>
            <ReserveRatioChart
              goldPriceNanoErg={oracle?.goldPriceNanoErg ?? 0}
              totalNeutronSupply={oracle?.totalNeutronSupply ?? 0}
              oracleLoading={oracleLoading}
              oracleError={oracleError}
            />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }}>
            <GaucYieldChart />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.5 }}>
            <CumulativeFeesChart />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.5 }}>
            <GaucLeverageChart
              currentLeverage={oracle?.currentLeverage}
              goldPriceNanoErg={oracle?.goldPriceNanoErg ?? 0}
              totalNeutronSupply={oracle?.totalNeutronSupply ?? 0}
              oracleLoading={oracleLoading}
              oracleError={oracleError}
            />
          </motion.div>

        </motion.div>
      </PageLayout>
    </>
  );
}
