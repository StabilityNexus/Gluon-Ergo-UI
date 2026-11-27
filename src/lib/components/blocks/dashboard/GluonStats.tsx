/**
 * @file GluonStats.tsx
 * @description Reactor statistics dashboard driven by GluonProvider snapshot and deployment metadata.
 * @module lib/components/blocks/dashboard
 */
"use client";

import { useState } from "react";
import { Card } from "@/lib/components/ui/card";
import { Skeleton } from "@/lib/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/lib/components/ui/tooltip";
import { convertFromDecimals, format, formatApprox } from "@/lib/utils/erg-converter";
import { formatUnits } from "@/lib/utils/amounts";
import { Scale, Percent, Loader2, TrendingUp, TrendingDown, Activity, Landmark } from "lucide-react";
import { cn } from "@/lib/utils/utils";
import { motion, AnimatePresence } from "framer-motion";
import NeutronIcon from "@/lib/components/icons/NeutronIcon";
import ProtonIcon from "@/lib/components/icons/ProtonIcon";
import { VolumeChart } from "@/lib/components/blocks/dashboard/VolumeChart";
import { useGluon } from "@/lib/hooks/useGluon";
import { formatQPercent, formatDriftPercent } from "@/lib/functions/reactor/health";
import { sumVolumeBuckets, formatFractionPercent } from "@/lib/functions/reactor/dashboard";
import { deriveReactorErrorMessage } from "@/lib/functions/reactor/availability";

type VolumeWindow = 1 | 7 | 14;

export function GluonStats() {
  const { snapshot, deployment, presentation, status, error } = useGluon();
  const [volumeWindow, setVolumeWindow] = useState<VolumeWindow>(14);

  const isLoading = !snapshot && status === "loading";
  const hasError = !snapshot && status === "error";
  const isStale = Boolean(snapshot && status === "error");

  const neutronName = deployment.tokens.neutron.name;
  const protonName = deployment.tokens.proton.name;
  const neutronDecimals = deployment.tokens.neutron.decimals;
  const protonDecimals = deployment.tokens.proton.decimals;

  const renderTooltip = (text: string, tooltipText: string) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="cursor-help">{text}</TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const renderPriceCard = (
    title: string,
    subtitle: string,
    nanoPrice: bigint | undefined,
    icon: React.ReactNode,
    delay: number,
    extraNote?: string
  ) => {
    const ergBN = nanoPrice !== undefined ? convertFromDecimals(nanoPrice, 9) : null;
    const exactErg = nanoPrice !== undefined ? formatUnits(nanoPrice, 9) : null;

    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4, ease: "easeOut" }}>
        <Card className={cn("flex h-full flex-col justify-between rounded-xl bg-gradient-to-br from-background to-muted/30 p-6 transition-all duration-300 hover:shadow-lg")}>
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
                <span className="text-sm text-muted-foreground">Loading…</span>
              </motion.div>
            ) : hasError ? (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                <span className="text-sm text-destructive">{deriveReactorErrorMessage(error)}</span>
              </motion.div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={nanoPrice?.toString() || "empty"}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  className="text-center"
                >
                  <div className="text-4xl font-bold">
                    {ergBN && exactErg ? renderTooltip(formatApprox(ergBN), `Price of 1 ${title}: ${exactErg} ERG`) : "—"}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">ERG</div>
                  {extraNote && <div className="mt-2 text-xs text-muted-foreground">{extraNote}</div>}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </Card>
      </motion.div>
    );
  };

  const pegDriftPercent = snapshot ? formatDriftPercent(snapshot.pegFactor, snapshot.initialPegFactor) : "—";
  const targetPriceFormatted = snapshot ? formatUnits(snapshot.targetPrice, 9) : "—";
  const targetNote = snapshot
    ? `Target: ${targetPriceFormatted} ERG (peg ${pegDriftPercent}% of initial)`
    : undefined;

  const volumePlusNano = snapshot ? sumVolumeBuckets(snapshot.volumes.plus, volumeWindow) : 0n;
  const volumeMinusNano = snapshot ? sumVolumeBuckets(snapshot.volumes.minus, volumeWindow) : 0n;

  const reserveBN = snapshot ? convertFromDecimals(snapshot.reserve, 9) : null;

  return (
    <div className="flex w-full flex-col gap-6">
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
              {isStale && (
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  Showing last known data
                </span>
              )}
            </div>
          </motion.div>

          {/* Token Price Grid */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {renderPriceCard(
              presentation.pegUnit,
              `${presentation.pegAsset} (from Oracle)`,
              snapshot?.pegUnitPrice,
              <Scale className="h-8 w-8" style={{ color: presentation.theme.primary }} />,
              0.1
            )}

            {renderPriceCard(
              neutronName,
              `${presentation.pegAsset} Pegged Token`,
              snapshot?.neutronPrice,
              <NeutronIcon className="h-8 w-8" />,
              0.2,
              targetNote
            )}

            {renderPriceCard(
              protonName,
              "Leveraged Yield Token",
              snapshot?.protonPrice,
              <ProtonIcon className="h-8 w-8" />,
              0.3
            )}
          </div>

          {/* Ratios */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4 }} className="flex-1">
            <Card className="border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <Percent className="h-5 w-5 text-primary" />
                <span className="text-lg font-semibold">Ratios</span>
              </div>
              <div className="grid grid-cols-1 gap-6 text-center sm:grid-cols-4">
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-foreground" data-testid="stat-fusion-ratio">
                    {isLoading ? <Skeleton className="mx-auto h-8 w-16" /> : snapshot ? `${formatQPercent(snapshot.q)}%` : "—"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {renderTooltip(
                      "Fusion Ratio (q)",
                      `Percentage of the reserve backing ${neutronName}. Healthy range is 50%–98%.`
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-2xl font-bold text-foreground" data-testid="stat-reserve-ratio">
                    {isLoading ? <Skeleton className="mx-auto h-8 w-16" /> : snapshot ? `${Math.round(snapshot.reserveRatio)}%` : "—"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {renderTooltip(
                      "Reserve Ratio",
                      `Total Reserve divided by the ${neutronName} supply valued at the target price (100 / q).`
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-2xl font-bold text-foreground" data-testid="stat-target-price">
                    {isLoading ? <Skeleton className="mx-auto h-8 w-20" /> : snapshot ? `${format(convertFromDecimals(snapshot.targetPrice, 9))} ERG` : "—"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {renderTooltip(
                      `${neutronName} Target Price`,
                      "Oracle price multiplied by the current peg factor."
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-2xl font-bold text-foreground" data-testid="stat-peg-drift">
                    {isLoading ? <Skeleton className="mx-auto h-8 w-16" /> : snapshot ? `${pegDriftPercent}%` : "—"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {renderTooltip(
                      "Peg Factor vs Initial",
                      "Current peg factor as a percentage of the initial peg factor at launch."
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Supplies and Volumes */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4 }} className="flex-1">
            <Card className="mt-6 border-border bg-card p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  <span className="text-lg font-semibold">Activity</span>
                </div>
                <div className="flex rounded-lg bg-muted p-0.5" role="group" aria-label="Volume time window">
                  {([1, 7, 14] as VolumeWindow[]).map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setVolumeWindow(days)}
                      aria-pressed={volumeWindow === days}
                      className={cn(
                        "rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors",
                        volumeWindow === days ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6 text-center sm:grid-cols-4">
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-foreground" data-testid="stat-volume-minus">
                    {isLoading ? <Skeleton className="mx-auto h-8 w-16" /> : snapshot ? convertFromDecimals(volumeMinusNano, 9).toFixed(2) : "—"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {volumeWindow}d {neutronName} to {protonName} Volume (ERG)
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-foreground" data-testid="stat-volume-plus">
                    {isLoading ? <Skeleton className="mx-auto h-8 w-16" /> : snapshot ? convertFromDecimals(volumePlusNano, 9).toFixed(2) : "—"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {volumeWindow}d {protonName} to {neutronName} Volume (ERG)
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-foreground" data-testid="stat-supply-neutron">
                    {isLoading ? <Skeleton className="mx-auto h-8 w-16" /> : snapshot ? convertFromDecimals(snapshot.neutronsInCirculation, neutronDecimals).toFixed(2) : "—"}
                  </div>
                  <div className="text-sm text-muted-foreground">{neutronName} Supply</div>
                </div>
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-foreground" data-testid="stat-supply-proton">
                    {isLoading ? <Skeleton className="mx-auto h-8 w-16" /> : snapshot ? convertFromDecimals(snapshot.protonsInCirculation, protonDecimals).toFixed(2) : "—"}
                  </div>
                  <div className="text-sm text-muted-foreground">{protonName} Supply</div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Right Card - TVL, Crash Cushion, Proton Leverage */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4, duration: 0.4 }} className="w-full xl:w-[320px]">
          <Card className="flex h-full flex-col border-border bg-gradient-to-b from-background to-muted/20 p-6">
            <div className="flex flex-1 flex-col items-center justify-center space-y-12">
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6, duration: 0.3 }} className="text-center">
                <div className="mb-4 flex items-center justify-center">
                  <Landmark className="mr-2 h-6 w-6 text-green-600" />
                </div>
                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <motion.div key="loading-tvl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
                      <Skeleton className="h-12 w-24" />
                      <Skeleton className="h-5 w-32" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key={snapshot?.reserve.toString() || "error"}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.3 }}
                      className="text-center"
                    >
                      <div className="mb-1 text-4xl font-bold text-foreground" data-testid="stat-tvl">
                        {reserveBN && snapshot
                          ? renderTooltip(`${formatApprox(reserveBN)} ERG`, `Total Value Locked: ${formatUnits(snapshot.reserve, 9)} ERG`)
                          : "—"}
                      </div>
                      <div className="text-sm font-medium text-muted-foreground">Reserve (TVL)</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, duration: 0.3 }} className="text-center">
                <div className="mb-4 flex items-center justify-center">
                  <TrendingDown className="mr-2 h-6 w-6" style={{ color: presentation.theme.primary }} />
                </div>
                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <motion.div key="loading-cushion" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
                      <Skeleton className="h-12 w-20" />
                      <Skeleton className="h-5 w-32" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key={snapshot?.crashCushion.untilDepeg.toString() || "error"}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.3 }}
                      className="text-center"
                    >
                      <div className="mb-1 text-4xl font-bold text-foreground" data-testid="stat-crash-cushion">
                        {snapshot ? `${formatFractionPercent(snapshot.crashCushion.untilDepeg)}%` : "—"}
                      </div>
                      <div className="text-sm font-medium text-muted-foreground">
                        {renderTooltip(
                          "Price Crash Cushion",
                          `Maximum drop in ERG price w.r.t. ${presentation.pegAsset} before ${neutronName} depegs.`
                        )}
                      </div>
                      {snapshot && (
                        <div className="mt-1 text-xs text-muted-foreground" data-testid="stat-until-adjustment">
                          {formatFractionPercent(snapshot.crashCushion.untilAdjustment)}% fall before trading pauses
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, duration: 0.3 }} className="text-center">
                <div className="mb-4 flex items-center justify-center">
                  <TrendingUp className="mr-2 h-6 w-6" style={{ color: presentation.theme.primary }} />
                </div>
                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <motion.div key="loading-leverage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
                      <Skeleton className="h-12 w-20" />
                      <Skeleton className="h-5 w-32" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key={snapshot?.protonLeverage?.toString() ?? "none"}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.3 }}
                      className="text-center"
                    >
                      <div className="mb-1 text-4xl font-bold text-foreground" data-testid="stat-proton-leverage">
                        {snapshot && snapshot.protonLeverage !== undefined ? `${snapshot.protonLeverage.toFixed(2)}x` : "—"}
                      </div>
                      <div className="text-sm font-medium text-muted-foreground">
                        {renderTooltip(
                          `${protonName} Leverage`,
                          `Factor by which ${protonName}'s price moves relative to ERG price changes w.r.t. ${presentation.pegAsset}.`
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      <VolumeChart />
    </div>
  );
}
