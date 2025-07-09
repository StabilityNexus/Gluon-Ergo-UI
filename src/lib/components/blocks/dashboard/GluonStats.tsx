"use client"

import { useEffect, useState } from "react"
import { Card } from "@/lib/components/ui/card"
import { Button } from "@/lib/components/ui/button"
import { Skeleton } from "@/lib/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/lib/components/ui/tooltip"
import { nanoErgsToErgs, formatMacroNumber, formatNumber } from "@/lib/utils/erg-converter"
import { Scale, BarChart3, Percent, Loader2, TrendingUp, Activity, Users } from "lucide-react"
import { cn } from "@/lib/utils/utils"
import { useRouter } from "next/navigation"
import BigNumber from "bignumber.js"
import { motion, AnimatePresence } from "framer-motion"
import ErgIcon from "@/lib/components/icons/ErgIcon"
import GauIcon from "@/lib/components/icons/GauIcon"
import GaucIcon from "@/lib/components/icons/GaucIcon"

interface GluonStats {
  ergPrice: number | null
  goldKgPrice: BigNumber | null
  gauPrice: BigNumber | null
  gaucPrice: BigNumber | null
  reserveRatio: number | null
  tvl: BigNumber | null
}

interface ProtocolMetrics {
  volume1Day: { protonsToNeutrons: number; neutronsToProtons: number }
  volume7Day: { protonsToNeutrons: number; neutronsToProtons: number }
  volume14Day: { protonsToNeutrons: number; neutronsToProtons: number }
  volumeArrays: {
    protonsToNeutrons: number[]
    neutronsToProtons: number[]
  }
  circulatingSupply: {
    protons: bigint
    neutrons: bigint
  }
}

const initialStats: GluonStats = {
  ergPrice: null,
  goldKgPrice: null,
  gauPrice: null,
  gaucPrice: null,
  reserveRatio: null,
  tvl: null
}

const initialMetrics: ProtocolMetrics = {
  volume1Day: { protonsToNeutrons: 0, neutronsToProtons: 0 },
  volume7Day: { protonsToNeutrons: 0, neutronsToProtons: 0 },
  volume14Day: { protonsToNeutrons: 0, neutronsToProtons: 0 },
  volumeArrays: { protonsToNeutrons: [], neutronsToProtons: [] },
  circulatingSupply: { protons: BigInt(0), neutrons: BigInt(0) }
}

export function GluonStats() {
  const [stats, setStats] = useState<GluonStats>(initialStats)
  const [protocolMetrics, setProtocolMetrics] = useState<ProtocolMetrics>(initialMetrics)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function fetchStats() {
      try {
        setHasError(false)
        const [ergPriceRes, sdk] = await Promise.all([
          fetch('/api/getErgPrice'),
          import('gluon-gold-sdk')
        ])

        const { price: ergPrice } = await ergPriceRes.json()
        const gluon = new sdk.Gluon()
        gluon.config.NETWORK = process.env.NEXT_PUBLIC_DEPLOYMENT || 'testnet'
        const gluonBox = await gluon.getGluonBox()
        const oracleBox = await gluon.getGoldOracleBox()

        // Fetch basic stats
        const [gaucPrice, goldKgPrice, reserveRatio, tvl] = await Promise.all([
          gluonBox.protonPrice(oracleBox),
          oracleBox.getPrice(),
          gluon.getReserveRatio(gluonBox, oracleBox),
          gluon.getTVL(gluonBox, oracleBox)
        ])

        // Fetch protocol metrics
        const [
          volume1DayPN, volume1DayNP,
          volume7DayPN, volume7DayNP,
          volume14DayPN, volume14DayNP,
          circProtons, circNeutrons
        ] = await Promise.all([
          gluonBox.accumulateVolumeProtonsToNeutrons(1),
          gluonBox.accumulateVolumeNeutronsToProtons(1),
          gluonBox.accumulateVolumeProtonsToNeutrons(7),
          gluonBox.accumulateVolumeNeutronsToProtons(7),
          gluonBox.accumulateVolumeProtonsToNeutrons(14),
          gluonBox.accumulateVolumeNeutronsToProtons(14),
          gluonBox.getProtonsCirculatingSupply(),
          gluonBox.getNeutronsCirculatingSupply()
        ])

        // Volume arrays not available in current SDK version
        const volumeArrays = { protonsToNeutrons: [], neutronsToProtons: [] }

        // Convert values to proper format
        const goldKgPriceBN = nanoErgsToErgs(goldKgPrice)
        const gaucPriceBN = nanoErgsToErgs(gaucPrice)
        const tvlBN = nanoErgsToErgs(tvl)

        setStats({
          ergPrice,
          goldKgPrice: goldKgPriceBN,
          // Convert from kg to gram by dividing by 1000
          gauPrice: goldKgPriceBN.dividedBy(1000),
          gaucPrice: gaucPriceBN,
          reserveRatio,
          tvl: tvlBN
        })

        setProtocolMetrics({
          volume1Day: { protonsToNeutrons: volume1DayPN, neutronsToProtons: volume1DayNP },
          volume7Day: { protonsToNeutrons: volume7DayPN, neutronsToProtons: volume7DayNP },
          volume14Day: { protonsToNeutrons: volume14DayPN, neutronsToProtons: volume14DayNP },
          volumeArrays,
          circulatingSupply: { protons: circProtons, neutrons: circNeutrons }
        })

        // Log real protocol data for debugging/graphing
        console.log("📊 Real Protocol Metrics:", {
          volumes: {
            "1Day": { fissions: volume1DayPN, fusions: volume1DayNP },
            "7Day": { fissions: volume7DayPN, fusions: volume7DayNP },
            "14Day": { fissions: volume14DayPN, fusions: volume14DayNP }
          },
          circulatingSupply: {
            gau: Number(circNeutrons),
            gauc: Number(circProtons)
          },
          volumeArrays: volumeArrays,
          prices: {
            goldKg: goldKgPriceBN.toNumber(),
            gau: goldKgPriceBN.dividedBy(1000).toNumber(),
            gauc: gaucPriceBN.toNumber(),
            erg: ergPrice
          },
          protocolHealth: {
            tvl: tvlBN.toNumber(),
            reserveRatio: reserveRatio
          }
        })

      } catch (error) {
        console.error("Failed to fetch stats:", error)
        setHasError(true)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
    // ERG price updates every 30 minutes, protocol data every 5 minutes
    const ergPriceInterval = setInterval(() => {
      fetch('/api/getErgPrice')
        .then(res => res.json())
        .then(data => {
          setStats(prev => ({ ...prev, ergPrice: data.price }))
        })
        .catch(console.error)
    }, 30 * 60 * 1000) // 30 minutes

    const protocolInterval = setInterval(fetchStats, 5 * 60 * 1000) // 5 minutes

    return () => {
      clearInterval(ergPriceInterval)
      clearInterval(protocolInterval)
    }
  }, [])

  // Helper function to format GAU supply properly
  const formatSupply = (supply: bigint): string => {
    const supplyNumber = Number(supply) / 1e9; // GAU GAUC have 9 decimals
    if (supplyNumber >= 1_000_000_000) {
      return `${(supplyNumber / 1_000_000_000).toFixed(2)}B`; // Billions
    } else if (supplyNumber >= 1_000_000) {
      return `${(supplyNumber / 1_000_000).toFixed(2)}M`; // Millions
    } else if (supplyNumber >= 1_000) {
      return `${(supplyNumber / 1_000).toFixed(2)}K`; // Thousands
    } else {
      return supplyNumber.toFixed(2); // Show small values normally
    }
  }

  const renderTooltip = (value: BigNumber | null, label: string) => {
    if (!value) return null;
    const formatted = formatNumber(value, false);
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger className="cursor-help">
            {formatNumber(value, true).display}
          </TooltipTrigger>
          <TooltipContent>
            <p>Exact {label}: {formatted.display} ERG</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const renderStatCard = (
    title: string,
    subtitle: string,
    value: BigNumber | null,
    icon: React.ReactNode,
    suffix: string = "",
    delay: number = 0
  ) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
    >
      <Card className={cn(
        "p-6 flex flex-col justify-between h-full",
        "rounded-xl hover:shadow-lg transition-all duration-300",
        "bg-gradient-to-br from-background to-muted/30"
      )}>
        <motion.div
          className="flex items-center gap-3 mb-4"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: delay + 0.1, duration: 0.3 }}
        >
          <motion.div
            className="flex items-center justify-center"
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ duration: 0.2 }}
          >
            {icon}
          </motion.div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground font-medium">{subtitle}</span>
            <span className="font-semibold text-sm">{title}</span>
          </div>
        </motion.div>

        <div className="flex flex-col items-center my-auto">
          {isLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2"
            >
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </motion.div>
          ) : hasError ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <span className="text-sm text-red-500">Error loading data</span>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={value?.toString() || "empty"}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="text-center"
              >
                <div className="text-4xl font-bold">
                  {value ? renderTooltip(value, title) : "—"}
                </div>
                <div className="text-sm text-muted-foreground mt-1">{suffix}</div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </Card>
    </motion.div>
  )

  return (
    <motion.div
      className="flex flex-col xl:flex-row gap-6 w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Left Section */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <motion.div
          className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-4">
            <h2 className="text-3xl md:text-5xl font-bold">Gluon Stats</h2>
            {isLoading && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="h-6 w-6 text-muted-foreground" />
              </motion.div>
            )}
          </div>
          <motion.div
            className='border px-3 py-1 rounded-xl text-sm bg-muted/50'
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            whileHover={{ scale: 1.05 }}
          >
            <span className="text-muted-foreground">ERG Price: </span>
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.span
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Skeleton className="inline-block w-12 h-4" />
                </motion.span>
              ) : (
                <motion.span
                  key={stats.ergPrice?.toString() || "error"}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                >
                  {hasError ? '—' : stats.ergPrice?.toFixed(2) || '—'}
                </motion.span>
              )}
            </AnimatePresence>
            <span className="text-muted-foreground text-xs pl-1">USD</span>
          </motion.div>
        </motion.div>

        {/* Token Grid - Responsive */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {renderStatCard(
            "1 kg of Gold",
            "Oracle Gold Price",
            stats.goldKgPrice,
            <Scale className="h-8 w-8 text-yellow-700" />,
            "ERG",
            0.1
          )}

          {renderStatCard(
            "GAU",
            "Gold-Pegged Stablecoin",
            stats.gauPrice,
            <GauIcon className="h-8 w-8" />,
            "ERG",
            0.2
          )}

          {renderStatCard(
            "GAUC",
            "Leveraged Yield Token",
            stats.gaucPrice,
            <GaucIcon className="h-8 w-8" />,
            "ERG",
            0.3
          )}
        </div>

        {/* Protocol Volume Metrics - Improved */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="flex-1"
        >
          <Card className="p-6 bg-card border-border">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-primary" />
              <span className="font-semibold text-lg">Protocol Activity</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-center">
              <div className="space-y-2">
                <div className="text-2xl font-bold text-foreground">
                  {isLoading ? <Skeleton className="h-8 w-16 mx-auto" /> : (hasError ? '—' : nanoErgsToErgs(protocolMetrics.volume14Day.neutronsToProtons).toFixed(2))}
                </div>
                <div className="text-sm text-muted-foreground">14d GAU to GAUC Volume (ERG)</div>
              </div>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-foreground">
                  {isLoading ? <Skeleton className="h-8 w-16 mx-auto" /> : (hasError ? '—' : nanoErgsToErgs(protocolMetrics.volume14Day.protonsToNeutrons).toFixed(2))}
                </div>
                <div className="text-sm text-muted-foreground">14d GAUC to GAU Volume (ERG)</div>
              </div>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-foreground">
                  {isLoading ? <Skeleton className="h-8 w-16 mx-auto" /> : (hasError ? '—' : formatSupply(protocolMetrics.circulatingSupply.neutrons))}
                </div>
                <div className="text-sm text-muted-foreground">GAU Supply</div>
              </div>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-foreground">
                  {isLoading ? <Skeleton className="h-8 w-16 mx-auto" /> : (hasError ? '—' : formatSupply(protocolMetrics.circulatingSupply.protons))}
                </div>
                <div className="text-sm text-muted-foreground">GAUC Supply</div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Right Card - Responsive and Properly Aligned */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="w-full xl:w-[320px]"
      >
        <Card className="h-full flex flex-col bg-gradient-to-b from-background to-muted/20 border-border p-6">
          <div className="flex-1 space-y-8 flex flex-col items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.3 }}
              className="text-center"
            >
              <div className="flex items-center justify-center mb-4">
                <Percent className="h-8 w-8 text-amber-600 mr-2" />
              </div>
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="loading-ratio"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-2"
                  >
                    <Skeleton className="w-20 h-12" />
                    <Skeleton className="w-32 h-5" />
                  </motion.div>
                ) : (
                  <motion.div
                    key={stats.reserveRatio?.toString() || "error"}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3 }}
                    className="text-center"
                  >
                    <div className="text-5xl font-bold text-foreground mb-1">
                      {hasError ? '—' : stats.reserveRatio ? Math.round(stats.reserveRatio) : '—'}%
                    </div>
                    <div className="font-medium text-sm text-muted-foreground">
                      Reserve Ratio
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, duration: 0.3 }}
              className="text-center"
            >
              <div className="flex items-center justify-center mb-4">
                <TrendingUp className="h-8 w-8 text-green-600 mr-2" />
              </div>
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="loading-tvl"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-2"
                  >
                    <Skeleton className="w-24 h-12" />
                    <Skeleton className="w-32 h-5" />
                  </motion.div>
                ) : (
                  <motion.div
                    key={stats.tvl?.toString() || "error"}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3 }}
                    className="text-center"
                  >
                    <div className="text-4xl font-bold text-foreground mb-1">
                      {hasError ? '—' : (stats.tvl ? renderTooltip(stats.tvl, "Total Value Locked") : '—')}
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Total Value Locked (ERG)
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.3 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="mt-8"
          >
            <Button
              size="lg"
              className="w-full h-12 text-white text-lg font-semibold bg-primary hover:bg-amber-600 dark:bg-primary dark:hover:bg-amber-700 transition-all duration-200 shadow-lg rounded-2xl"
              onClick={() => router.push('/reactor/swap')}
              disabled={isLoading || hasError}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                'Swap Now'
              )}
            </Button>
          </motion.div>
        </Card>
      </motion.div>
    </motion.div>
  )
}
