import { GluonStats } from "@/lib/components/blocks/dashboard/GluonStats";
import ReactorLayout from "../layout";
import { MyStats } from "@/lib/components/blocks/dashboard/MyStats";
import { SEO } from "@/lib/components/layout/SEO";
import { motion } from "framer-motion";
import { VolumeChart } from "@/lib/components/blocks/dashboard/VolumeChart";

export default function ReactorDashboard() {
  return (
    <>
      <SEO
        title="Reactor Dashboard"
        description="Monitor your Gluon portfolio, track token prices, and analyze market statistics in real-time with our comprehensive DeFi dashboard."
        keywords="Gluon Dashboard, DeFi Stats, GAU Price, GAUC Price, Gold Price, Portfolio Tracker, Ergo DeFi"
      />
      <ReactorLayout>
        <motion.div
          className='container mx-auto pb-8 px-4 sm:px-6 lg:px-8 space-y-8'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <GluonStats />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
          >
            <VolumeChart isLoading={false} hasError={false} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <MyStats />
          </motion.div>
        </motion.div>
      </ReactorLayout>
    </>
  );
}
