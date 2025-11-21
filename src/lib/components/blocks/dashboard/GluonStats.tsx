"use client";

import { useEffect, useState } from "react";
import { Card } from "@/lib/components/ui/card";
import { Skeleton } from "@/lib/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/lib/components/ui/tooltip";
import { nanoErgsToErgs, convertFromDecimals, formatNumber } from "@/lib/utils/erg-converter";
import { Scale, Percent, Loader2, Expand, TrendingUp, Activity } from "lucide-react";
import { cn } from "@/lib/utils/utils";
import { useRouter } from "next/navigation";
import BigNumber from "bignumber.js";
import { motion, AnimatePresence } from "framer-motion";
import GauIcon from "@/lib/components/icons/GauIcon";
import GaucIcon from "@/lib/components/icons/GaucIcon";

interface GluonStats {
  ergPrice: number | null;
  goldKgPrice: BigNumber | null;
  gauPrice: BigNumber | null;
  gaucPrice: BigNumber | null;
  reserveRatio: number | null;
  tvl: BigNumber | null;
}

interface ProtocolMetrics {
  volume1Day: { protonsToNeutrons: number; neutronsToProtons: number };
  volume7Day: { protonsToNeutrons: number; neutronsToProtons: number };
  volume14Day: { protonsToNeutrons: number; neutronsToProtons: number };
  volumeArrays: {
    protonsToNeutrons: number[];
    neutronsToProtons: number[];
  };
  circulatingSupply: {
    protons: bigint;
    neutrons: bigint;
  };
}

const initialStats: GluonStats = {
  ergPrice: null,
  goldKgPrice: null,
  gauPrice: null,
  gaucPrice: null,
  reserveRatio: null,
  tvl: null,
};

const initialMetrics: ProtocolMetrics = {
  volume1Day: { protonsToNeutrons: 0, neutronsToProtons: 0 },
  volume7Day: { protonsToNeutrons: 0, neutronsToProtons: 0 },
  volume14Day: { protonsToNeutrons: 0, neutronsToProtons: 0 },
  volumeArrays: { protonsToNeutrons: [], neutronsToProtons: [] },
  circulatingSupply: { protons: BigInt(0), neutrons: BigInt(0) },
};

export function GluonStats() {
  const [stats, setStats] = useState<GluonStats>(initialStats);
  const [protocolMetrics, setProtocolMetrics] = useState<ProtocolMetrics>(initialMetrics);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const router = useRouter();

  useEffect(() => {
    async function fetchStats() {
      try {
        setHasError(false);
        const [ergPriceRes, sdk] = await Promise.all([fetch("/api/getErgPrice"), import("gluon-gold-sdk")]);

        const { price: ergPrice } = await ergPriceRes.json();
        const gluon = new sdk.Gluon();
        gluon.config.NETWORK = process.env.NEXT_PUBLIC_DEPLOYMENT || "testnet";
        const gluonBox = await gluon.getGluonBox();
        const oracleBox = await gluon.getGoldOracleBox();

        // Fetch basic stats
        const [gaucPrice, goldKgPrice, reserveRatio, tvl] = await Promise.all([
          gluonBox.protonPrice(oracleBox),
          oracleBox.getPrice(),
          gluon.getReserveRatio(gluonBox, oracleBox),
          gluon.getTVL(gluonBox, oracleBox),
        ]);

        // Fetch protocol metrics
        const [volume1DayPN, volume1DayNP, volume7DayPN, volume7DayNP, volume14DayPN, volume14DayNP, circProtons, circNeutrons] = await Promise.all([
          gluonBox.accumulateVolumeProtonsToNeutrons(1),
          gluonBox.accumulateVolumeNeutronsToProtons(1),
          gluonBox.accumulateVolumeProtonsToNeutrons(7),
          gluonBox.accumulateVolumeNeutronsToProtons(7),
          gluonBox.accumulateVolumeProtonsToNeutrons(14),
          gluonBox.accumulateVolumeNeutronsToProtons(14),
          gluonBox.getProtonsCirculatingSupply(),
          gluonBox.getNeutronsCirculatingSupply(),
        ]);

        // Volume arrays not available in current SDK version
        const volumeArrays = { protonsToNeutrons: [], neutronsToProtons: [] };

        // Convert values to proper format
        const goldKgPriceBN = nanoErgsToErgs(goldKgPrice);
        const gaucPriceBN = nanoErgsToErgs(gaucPrice);
        const tvlBN = nanoErgsToErgs(tvl);
        const gauPriceBN = tvlBN.minus(convertFromDecimals(circProtons).multipliedBy(gaucPriceBN)).dividedBy(convertFromDecimals(circNeutrons));

        setStats({
          ergPrice,
          goldKgPrice: goldKgPriceBN,
          gauPrice: gauPriceBN,
          gaucPrice: gaucPriceBN,
          reserveRatio,
          tvl: tvlBN,
        });

        setProtocolMetrics({
          volume1Day: {
            protonsToNeutrons: volume1DayPN,
            neutronsToProtons: volume1DayNP,
          },
          volume7Day: {
            protonsToNeutrons: volume7DayPN,
            neutronsToProtons: volume7DayNP,
          },
          volume14Day: {
            protonsToNeutrons: volume14DayPN,
            neutronsToProtons: volume14DayNP,
          },
          volumeArrays,
          circulatingSupply: { protons: circProtons, neutrons: circNeutrons },
        });

        // Log real protocol data for debugging/graphing
        console.log("📊 Real Protocol Metrics:", {
          volumes: {
            "1Day": { fissions: volume1DayPN, fusions: volume1DayNP },
            "7Day": { fissions: volume7DayPN, fusions: volume7DayNP },
            "14Day": { fissions: volume14DayPN, fusions: volume14DayNP },
          },
          circulatingSupply: {
            gau: Number(circNeutrons),
            gauc: Number(circProtons),
          },
          volumeArrays: volumeArrays,
          prices: {
            goldKg: goldKgPriceBN.toNumber(),
            gau: gauPriceBN.toNumber(),
            gauc: gaucPriceBN.toNumber(),
            erg: ergPrice,
          },
          protocolHealth: {
            tvl: tvlBN.toNumber(),
            reserveRatio: reserveRatio,
          },
        });
      } catch (error) {
        console.error("Failed to fetch stats:", error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
    // ERG price updates every 30 minutes, protocol data every 5 minutes
    const ergPriceInterval = setInterval(
      () => {
        fetch("/api/getErgPrice")
          .then((res) => res.json())
          .then((data) => {
            setStats((prev) => ({ ...prev, ergPrice: data.price }));
          })
          .catch(console.error);
      },
      30 * 60 * 1000
    ); // 30 minutes

    const protocolInterval = setInterval(fetchStats, 5 * 60 * 1000); // 5 minutes

    return () => {
      clearInterval(ergPriceInterval);
      clearInterval(protocolInterval);
    };
  }, []);

  const renderTooltip = (value: BigNumber | null, label: string) => {
    if (!value) return null;
    const formatted = formatNumber(value, false);
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger className="cursor-help">{formatNumber(value, true).display}</TooltipTrigger>
          <TooltipContent>
            <p>
              Exact {label}: {formatted.display} ERG
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const renderStatCard = (title: string, subtitle: string, value: BigNumber | null, icon: React.ReactNode, suffix: string = "", delay: number = 0) => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4, ease: "easeOut" }}>
      <Card className={cn("flex h-full flex-col justify-between p-6", "rounded-xl transition-all duration-300 hover:shadow-lg", "bg-gradient-to-br from-background to-muted/30")}>
        <motion.div className="mb-4 flex items-center gap-3" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: delay + 0.1, duration: 0.3 }}>
          <motion.div className="flex items-center justify-center" whileHover={{ scale: 1.1, rotate: 5 }} transition={{ duration: 0.2 }}>
            {icon}
          </motion.div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted-foreground">{subtitle}</span>
            <span className="text-sm font-semibold">{title}</span>
          </div>
        </motion.div>

        <div className="my-auto flex flex-col items-center">
          {isLoading ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </motion.div>
          ) : hasError ? (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
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
                <div className="text-4xl font-bold">{value ? renderTooltip(value, title + " Price") : "—"}</div>
                <div className="mt-1 text-sm text-muted-foreground">{suffix}</div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </Card>
    </motion.div>
  );

  return (
    <motion.div className="flex w-full flex-col gap-6 xl:flex-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      {/* Left Section */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <motion.div
          className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-bold md:text-5xl">Gluon Stats</h2>
            {isLoading && (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                <Loader2 className="h-6 w-6 text-muted-foreground" />
              </motion.div>
            )}
          </div>
          <motion.div
            className="rounded-xl border bg-muted/50 px-3 py-1 text-sm"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            whileHover={{ scale: 1.05 }}
          >
            <span className="text-muted-foreground">ERG Price: </span>
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Skeleton className="inline-block h-4 w-12" />
                </motion.span>
              ) : (
                <motion.span
                  key={stats.ergPrice?.toString() || "error"}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                >
                  {hasError ? "—" : stats.ergPrice?.toFixed(2) || "—"}
                </motion.span>
              )}
            </AnimatePresence>
            <span className="pl-1 text-xs text-muted-foreground">USD</span>
          </motion.div>
        </motion.div>

        {/* Token Grid - Responsive */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {renderStatCard("1 gram of Gold", "Oracle Gold Price", stats.goldKgPrice?.dividedBy(1000) || null, <Scale className="h-8 w-8 text-yellow-700" />, "ERG", 0.1)}

          {renderStatCard("GAU", "Gold Pegged Token", stats.gauPrice, <GauIcon className="h-8 w-8" />, "ERG", 0.2)}

          {renderStatCard("GAUC", "Leveraged Yield Token", stats.gaucPrice, <GaucIcon className="h-8 w-8" />, "ERG", 0.3)}
        </div>

        {/* Protocol Volume Metrics - Improved */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4 }} className="flex-1">
          <Card className="border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <span className="text-lg font-semibold">Protocol Activity</span>
            </div>
            <div className="grid grid-cols-1 gap-6 text-center sm:grid-cols-4">
              <div className="space-y-2">
                <div className="text-2xl font-bold text-foreground">
                  {isLoading ? <Skeleton className="mx-auto h-8 w-16" /> : hasError ? "—" : nanoErgsToErgs(protocolMetrics.volume14Day.neutronsToProtons).toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">14d GAU to GAUC Volume (ERG)</div>
              </div>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-foreground">
                  {isLoading ? <Skeleton className="mx-auto h-8 w-16" /> : hasError ? "—" : nanoErgsToErgs(protocolMetrics.volume14Day.protonsToNeutrons).toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">14d GAUC to GAU Volume (ERG)</div>
              </div>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-foreground">
                  {isLoading ? <Skeleton className="mx-auto h-8 w-16" /> : hasError ? "—" : convertFromDecimals(protocolMetrics.circulatingSupply.neutrons).toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">GAU Supply</div>
              </div>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-foreground">
                  {isLoading ? <Skeleton className="mx-auto h-8 w-16" /> : hasError ? "—" : convertFromDecimals(protocolMetrics.circulatingSupply.protons).toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">GAUC Supply</div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Right Card - Responsive and Properly Aligned */}
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4, duration: 0.4 }} className="w-full xl:w-[320px]">
        <Card className="flex h-full flex-col border-border bg-gradient-to-b from-background to-muted/20 p-6">
          <div className="flex flex-1 flex-col items-center justify-center space-y-8">
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, duration: 0.3 }} className="text-center">
              <div className="mb-4 flex items-center justify-center">
                <Percent className="mr-2 h-6 w-6 text-amber-600" />
              </div>
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div key="loading-ratio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
                    <Skeleton className="h-12 w-20" />
                    <Skeleton className="h-5 w-32" />
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
                    <div className="mb-1 text-4xl font-bold text-foreground">{hasError ? "—" : stats.tvl ? stats.goldKgPrice ? Math.round(1e14 * +stats.tvl  / (+BigNumber(protocolMetrics.circulatingSupply.neutrons) * +stats.goldKgPrice) ) : "—" : "-" }%</div>
                    <div className="text-sm font-medium text-muted-foreground">Reserve Ratio</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, duration: 0.3 }} className="text-center">
              <div className="mb-4 flex items-center justify-center">
                <Percent className="mr-2 h-6 w-6 text-amber-600" />
              </div>
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div key="loading-ratio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
                    <Skeleton className="h-12 w-20" />
                    <Skeleton className="h-5 w-32" />
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
                    <div className="mb-1 text-4xl font-bold text-foreground">{hasError ? "—" : stats.reserveRatio ? Math.round(10000 / stats.reserveRatio) : "—"}%</div>
                    <div className="text-sm font-medium text-muted-foreground">Fusion Ratio</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, duration: 0.3 }} className="text-center">
              <div className="mb-4 flex items-center justify-center">
                <Percent className="mr-2 h-6 w-6 text-amber-600" />
              </div>
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div key="loading-ratio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
                    <Skeleton className="h-12 w-20" />
                    <Skeleton className="h-5 w-32" />
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
                    <div className="mb-1 text-4xl font-bold text-foreground">{hasError ? "—" : stats.reserveRatio ? Math.round(stats.reserveRatio) : "—"}%</div>
                    <div className="text-sm font-medium text-muted-foreground">Normalized Reserve Ratio</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.3 }}
              className="text-center"
            >
              <div className="flex items-center justify-center mb-4">
                <Expand className="h-6 w-6 text-amber-600 mr-2" />
              </div>
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div key="loading-ratio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
                    <Skeleton className="h-12 w-20" />
                    <Skeleton className="h-5 w-32" />
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
                    <div className="text-4xl font-bold text-foreground mb-1">
                      {hasError ? '—' : stats.reserveRatio ? Math.round(- (100 / (100 - stats.reserveRatio)) * 100)/100 : '—'}x <br />
                    </div>
                    <div className="font-medium text-sm text-muted-foreground">
                      GAUC Leverage
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6, duration: 0.3 }} className="text-center">
              <div className="mb-4 flex items-center justify-center">
                <TrendingUp className="mr-2 h-6 w-6 text-green-600" />
              </div>
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div key="loading-tvl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
                    <Skeleton className="h-12 w-24" />
                    <Skeleton className="h-5 w-32" />
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
                    <div className="mb-1 text-4xl font-bold text-foreground">{hasError ? "—" : stats.tvl ? renderTooltip(stats.tvl, "Total Value Locked") : "—"}</div>
                    <div className="text-sm font-medium text-muted-foreground">Reserve (TVL)</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

        </Card>
      </motion.div>
    </motion.div>
  );
}
