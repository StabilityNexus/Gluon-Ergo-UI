"use client";

import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine,
  Tooltip as RechartsTooltip, ResponsiveContainer
} from "recharts";
import type { TooltipProps } from "recharts";
import { format as dateFnsFormat } from "date-fns";
import { Loader2 } from "lucide-react";
import { useGluonTransactionHistory } from "@/lib/hooks/useGluonTransactionHistory";
import type { GluonBoxSnapshot } from "@/lib/hooks/useGluonTransactionHistory";
import { useTheme } from "next-themes";

type TimeRange = "ALL" | "90D" | "30D";
const SPARSE_THRESHOLD = 10;

interface GaucLeverageChartProps {
  goldPriceNanoErg: number;
  totalNeutronSupply: number;
  currentLeverage?: number;
  oracleLoading?: boolean;
  oracleError?: string | null;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload?.length) return null;
  const lev = payload[0]?.value;
  const dateStr = dateFnsFormat(new Date(label as number), "MMM d, yyyy HH:mm");

  return (
    <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1e1e1e] px-3 py-2 text-xs shadow-md dark:shadow-none">
      <p className="mb-1 text-gray-500 dark:text-white/40">{dateStr}</p>
      <p className="text-sm font-semibold text-amber-400">
        {typeof lev === "number" ? `${lev.toFixed(2)}x` : "—"} Leverage
      </p>
    </div>
  );
};

export function GaucLeverageChart({
  currentLeverage,
  goldPriceNanoErg,
  totalNeutronSupply,
  oracleLoading,
  oracleError,
}: GaucLeverageChartProps) {
  const [range, setRange] = useState<TimeRange>("ALL");
  const { snapshots, loading, error, migrationHeights } = useGluonTransactionHistory();
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === "dark";
  const isSparse = snapshots.length < SPARSE_THRESHOLD;

  // True when at least one snapshot has a historical oracle price (oracle fetch succeeded)
  const hasOracleData = useMemo(
    () => snapshots.some(s => s.goldPriceNanoErg > 0),
    [snapshots]
  );

  const { chartData, timeDomain, xTicks, tickFormatter } = useMemo(() => {
    if (!totalNeutronSupply || snapshots.length === 0) {
      return {
        chartData: [],
        timeDomain: ["dataMin", "dataMax"] as [any, any],
        xTicks: [] as number[],
        tickFormatter: (v: number): string => "",
      };
    }

    const now = Date.now();
    let filteredSnapshots: GluonBoxSnapshot[] = [];

    if (range === "ALL" || isSparse) {
      filteredSnapshots = snapshots;
    } else {
      const days = range === "90D" ? 90 : 30;
      const cutoff = now - days * 24 * 60 * 60 * 1000;

      const inRange = snapshots.filter(s => s.timestamp >= cutoff);
      const beforeRange = snapshots.filter(s => s.timestamp < cutoff);
      const lastBefore = beforeRange.length > 0 ? beforeRange[beforeRange.length - 1] : null;

      if (lastBefore) {
        filteredSnapshots.push({
          ...lastBefore,
          timestamp: cutoff,
        });
      }

      filteredSnapshots.push(...inRange);

      const latest = filteredSnapshots[filteredSnapshots.length - 1];
      if (latest && latest.timestamp < now - 60_000) {
        filteredSnapshots.push({
          ...latest,
          timestamp: now,
        });
      }
    }

    const finalData = filteredSnapshots.map(s => {
      const circNeutronsRaw = totalNeutronSupply - s.neutronAmount;
      const effectiveGoldPrice = s.goldPriceNanoErg > 0 ? s.goldPriceNanoErg : goldPriceNanoErg;
      if (circNeutronsRaw <= 0 || effectiveGoldPrice <= 0) return null;

      // Use fissioned TVL (minus 1,000,000 nanoERG) matching SDK's getTVL() and getErgFissioned()
      const tvlNano = s.ergValue * 1e9;
      const tvlFissioned = tvlNano - 1000000;
      if (Math.floor(tvlFissioned) <= 0) return null;
      
      // Step 2: Exact normalized reserve ratio logic from Gluon SDK (gluon.getReserveRatio)
      const qstar = BigInt(660000000);
      const pricePerGram = effectiveGoldPrice / 1000;
      if (Math.floor(pricePerGram) <= 0) return null;

      const rightHandMinVal = (BigInt(Math.floor(circNeutronsRaw)) * BigInt(Math.floor(pricePerGram))) / BigInt(Math.floor(tvlFissioned));
      const fusionRatio = rightHandMinVal < qstar ? rightHandMinVal : qstar;
      if (fusionRatio <= BigInt(0)) return null;
      const normalizedReserveRatio = (100 * 1e9) / Number(fusionRatio);

      // Step 3: gaucLeverage — exactly GluonStats.tsx line 130:
      //   gaucLeverageBN = BigNumber(Math.round(-(100 / (100 - normalizedReserveRatio)) * 100) / 100)
      if (normalizedReserveRatio === 100) return null; // strictly prevent division by zero

      const leverage = Math.round(-(100 / (100 - normalizedReserveRatio)) * 100) / 100;

      if (!Number.isFinite(leverage) || Math.abs(leverage) > 100) return null;

      return { timestamp: s.timestamp, leverage };
    }).filter((p): p is { timestamp: number; leverage: number } => p !== null);
    
    let domain: [number | string, number | string] = ["dataMin", "dataMax"];
    let ticks: number[] = [];
    let formatter = (v: number) => dateFnsFormat(new Date(v), "MMM");

    if (range === "ALL" || isSparse) {
      const seen = new Set<string>();
      for (const d of finalData) {
        const key = dateFnsFormat(new Date(d.timestamp), "yyyy-MM");
        if (!seen.has(key)) {
          seen.add(key);
          ticks.push(d.timestamp);
        }
      }
    } else {
      const days = range === "90D" ? 90 : 30;
      const cutoff = now - days * 24 * 60 * 60 * 1000;
      domain = [cutoff, now];
      const count = range === "90D" ? 6 : 5;
      const step = (now - cutoff) / (count - 1);
      ticks = Array.from({ length: count }, (_, i) => Math.round(cutoff + i * step));
      formatter = (v: number) => dateFnsFormat(new Date(v), "MMM d");
    }

    return {
      chartData: finalData,
      timeDomain: domain,
      xTicks: ticks,
      tickFormatter: formatter,
    };
  }, [snapshots, range, isSparse, goldPriceNanoErg, totalNeutronSupply]);

  // Subtle vertical divider at contract address change — neutral, no label
  const migrationTimestamps = useMemo(() => {
    if (migrationHeights.length === 0 || snapshots.length === 0) return [];
    return migrationHeights.map(mh => {
      const closest = snapshots.reduce((best, s) =>
        Math.abs(s.height - mh) < Math.abs(best.height - mh) ? s : best
      );
      return closest.timestamp;
    });
  }, [migrationHeights, snapshots]);

  return (
    <div className="mt-6 rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-[#141414] p-5">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">GAUC Leverage</h3>
          {currentLeverage !== undefined && Number.isFinite(currentLeverage) && (
            <span className="text-xs font-semibold text-amber-400">Live: {currentLeverage.toFixed(2)}x</span>
          )}
          <span className="text-xs font-normal text-gray-400 dark:text-white/40">from on-chain history</span>
          {!hasOracleData && !loading && snapshots.length > 0 && (
            <span className="text-xs font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
              Oracle history unavailable — using live gold price for all points
            </span>
          )}
          {isSparse && (
            <span className="text-xs font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
              Showing all {snapshots.length} available snapshots
            </span>
          )}
        </div>

        <div className="flex rounded-lg bg-gray-100 dark:bg-white/5 p-0.5">
          {(["ALL", "90D", "30D"] as TimeRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={[
                "rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors",
                (isSparse ? r === "ALL" : range === r)
                  ? "bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white"
                  : "text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/60",
              ].join(" ")}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="h-56 w-full">
        {loading || (oracleLoading && !totalNeutronSupply) ? (
          <div className="flex h-full items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400 dark:text-white/40" />
            <span className="text-xs text-gray-400 dark:text-white/40">Loading on-chain history…</span>
          </div>
        ) : (error || oracleError) && chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-red-400 text-center">{error || oracleError}</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-gray-400 dark:text-white/40 text-center">No leverage data available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)"} vertical={false} />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={timeDomain}
                ticks={xTicks.length > 0 ? xTicks : undefined}
                tickFormatter={tickFormatter}
                tick={{ fill: isDark ? "rgba(255,255,255,0.3)" : "#6b7280", fontSize: 11 }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `${v}x`}
                tick={{ fill: isDark ? "rgba(255,255,255,0.3)" : "#6b7280", fontSize: 11 }}
                axisLine={false} tickLine={false}
              />
              <RechartsTooltip content={<CustomTooltip />} />

              {currentLeverage !== undefined && Number.isFinite(currentLeverage) && (
                <ReferenceLine
                  y={currentLeverage}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{ value: `Live`, fill: "#f59e0b", fontSize: 10, position: "insideTopRight" }}
                />
              )}

              {/* Subtle vertical divider at contract address change — no label, neutral */}
              {migrationTimestamps.map((ts, idx) => (
                <ReferenceLine
                  key={`migration-${idx}`}
                  x={ts}
                  stroke={isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
              ))}

              <Line
                type="monotone"
                dataKey="leverage"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                isAnimationActive={true}
                activeDot={{ r: 4, fill: "#f59e0b", stroke: "#141414", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
