import { GluonStats } from "@/lib/components/blocks/dashboard/GluonStats";
import PageLayout from "../layout";
import { MyStats } from "@/lib/components/blocks/dashboard/MyStats";
import { SEO } from "@/lib/components/layout/SEO";
import { tokenConfig } from "@/config/tokenConfig";
import { motion } from "framer-motion";

export default function ReactorDashboard() {
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

        </motion.div>
      </PageLayout>
    </>
  );
}
