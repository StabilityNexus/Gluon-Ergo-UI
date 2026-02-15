import { GluonStats } from "@/lib/components/blocks/dashboard/GluonStats";
import PageLayout from "../layout";
import { MyStats } from "@/lib/components/blocks/dashboard/MyStats";
import { SEO } from "@/lib/components/layout/SEO";
import { tokenConfig } from "@/config/tokenConfig";
import { motion } from "framer-motion";
import { VolumeChart } from "@/lib/components/blocks/dashboard/VolumeChart";

export default function ReactorDashboard() {
  return (
    <>
      <SEO
        title="Reactor Dashboard"
        description="Monitor your Gluon portfolio, track token prices, and analyze market statistics in real-time with our comprehensive DeFi dashboard."
        keywords={`Gluon Dashboard, DeFi Stats, ${tokenConfig.stableAsset.symbol} Price, ${tokenConfig.volatileAsset.symbol} Price, ${tokenConfig.peg.type} Price, Portfolio Tracker, Ergo DeFi`}
      />
      <PageLayout>
        <motion.div
          className="mx-auto w-full max-w-7xl space-y-8 rounded-2xl border border-border/50 bg-card/30 px-4 py-8 shadow-lg backdrop-blur-sm sm:px-6 lg:px-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}>
            <GluonStats />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5 }}>
            <VolumeChart isLoading={false} hasError={false} />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
            <MyStats />
          </motion.div>
        </motion.div>
      </PageLayout>
    </>
  );
}
