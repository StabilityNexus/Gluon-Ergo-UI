"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { TooltipProps } from "recharts";
import { format as dateFnsFormat } from "date-fns";
import { Loader2 } from "lucide-react";
import { useGluonFeeBreakdown } from "@/lib/hooks/useGluonFeeBreakdown";
import type { CumulativeFeePoint } from "@/lib/hooks/useGluonFeeBreakdown";
import { useTheme } from "next-themes";
import { tokenConfig } from "@/config/tokenConfig";

/**
 * @file CumulativeFeesChart.tsx
 * @description Displays cumulative protocol fees split into categories:
 *   - Fission dev fee + dilution value     (exact)       ── indigo solid area
 *   - Fusion dev fee + dilution value      (exact)       ── amber solid area
 *   - Transmutation (GAU → GAUC) dilution + dev (estimate †) ── purple dashed line
 *   - Transmutation (GAUC → GAU) dilution + dev (estimate †) ── pink dashed line
 *   - Oracle fee on transmutation txs      (exact*)      ── teal solid area
 *
 * Fission, fusion, and oracle are stacked solid areas. The two transmutation
 * directions are separate dashed lines (not stacked), clearly marked as estimates,
 * and can be toggled off together by the user.
 *
 * Precision notes:
 *   - Fission/fusion: exact register diff + algebraic token-shortfall × price
 *   - Oracle: exact given token price at each block (SDK: 0.1% × ERG volume)
 *   - Transmutation dilution †: varPhiBeta rate × per-tx volume (rate-based estimate)
 *
 * Chart conventions match GaucYieldChart.tsx and ReserveRatioChart.tsx:
 *   - Card wrapper, time-range buttons (ALL/90D/30D)
 *   - Month-only X-axis ticks (one per calendar month)
 *   - Custom tooltip with dark/light support
 *   - Footnote row for block-height approximation
 */

type TimeRange = "ALL" | "90D" | "30D";
const SPARSE_THRESHOLD = 10;

// ─── Tooltip ────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload as {
    fission?: number;
    fusion?: number;
    transmuteNeutronToProton?: number;
    transmuteProtonToNeutron?: number;
    oracle?: number;
  } | undefined;

  const get = (key: string) => {
    const fromPayload = payload.find((p) => p.dataKey === key)?.value;
    if (typeof fromPayload === "number") return fromPayload;
    if (row && typeof (row as Record<string, number | undefined>)[key] === "number") {
      return (row as Record<string, number | undefined>)[key];
    }
    return undefined;
  };

  const fission = get("fission") ?? 0;
  const fusion = get("fusion") ?? 0;
  const transmuteNP = get("transmuteNeutronToProton") ?? 0;
  const transmutePN = get("transmuteProtonToNeutron") ?? 0;
  const oracle = get("oracle") ?? 0;
  const displayedTotal = fission + fusion + transmuteNP + transmutePN + oracle;

  const dateStr = dateFnsFormat(new Date(label as number), "MMM d, yyyy");

  return (
    <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1e1e1e] px-3 py-2 text-xs shadow-md dark:shadow-none min-w-[200px]">
      <p className="mb-2 text-gray-500 dark:text-white/40">{dateStr}</p>
      <p className="text-indigo-500 dark:text-indigo-400">
        Fission: {fission.toFixed(4)} ERG
      </p>
      <p className="text-amber-500 dark:text-amber-400">
        Fusion: {fusion.toFixed(4)} ERG
      </p>
      <p className="text-purple-400">
        Transmutation ({tokenConfig.stableAsset.symbol} → {tokenConfig.volatileAsset.symbol}) †: {transmuteNP.toFixed(4)} ERG
      </p>
      <p className="text-pink-400">
        Transmutation ({tokenConfig.volatileAsset.symbol} → {tokenConfig.stableAsset.symbol}) †: {transmutePN.toFixed(4)} ERG
      </p>
      <p className="text-teal-500 dark:text-teal-400">
        Oracle: {oracle.toFixed(4)} ERG
      </p>
      <p className="mt-1 pt-1 border-t border-gray-100 dark:border-white/10 font-semibold text-gray-900 dark:text-white">
        Total: {displayedTotal.toFixed(4)} ERG
      </p>
      <p className="mt-1 text-[10px] text-gray-400 dark:text-white/25">
        † Transmutation fee is estimated
      </p>
    </div>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────

export function CumulativeFeesChart() {
  const [range, setRange] = useState<TimeRange>("ALL");
  const [showTransmuteEstimate, setShowTransmuteEstimate] = useState(true);
  const { points, loading, error } = useGluonFeeBreakdown();
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === "dark";
  const isSparse = points.length < SPARSE_THRESHOLD;

  // ── Filter by time range & compute time domain / ticks ────────────────
  const { chartData, timeDomain, xTicks, tickFormatter } = useMemo(() => {
    if (points.length === 0) {
      return {
        chartData: [],
        timeDomain: ["dataMin", "dataMax"] as [any, any],
        xTicks: [] as number[],
        tickFormatter: (v: number): string => "",
      };
    }

    const now = Date.now();
    let filtered: CumulativeFeePoint[] = [];

    if (range === "ALL" || isSparse) {
      filtered = [...points];
    } else {
      const days = range === "90D" ? 90 : 30;
      const cutoff = now - days * 24 * 60 * 60 * 1000;

      const inRange = points.filter((p) => p.timestamp >= cutoff);
      const beforeRange = points.filter((p) => p.timestamp < cutoff);
      const lastBefore = beforeRange.length > 0 ? beforeRange[beforeRange.length - 1] : null;

      if (lastBefore) {
        filtered.push({
          ...lastBefore,
          timestamp: cutoff,
        });
      }

      filtered.push(...inRange);

      const latest = filtered[filtered.length - 1];
      if (latest && latest.timestamp < now - 60_000) {
        filtered.push({
          ...latest,
          timestamp: now,
        });
      }
    }

    let domain: [number | string, number | string] = ["dataMin", "dataMax"];
    let ticks: number[] = [];
    let formatter = (v: number) => dateFnsFormat(new Date(v), "MMM");

    if (range === "ALL" || isSparse) {
      const seen = new Set<string>();
      for (const d of filtered) {
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
      chartData: filtered,
      timeDomain: domain,
      xTicks: ticks,
      tickFormatter: formatter,
    };
  }, [points, range, isSparse]);

  // ── Y-axis: scale to the max total in view ─────────────────────────────
  const yAxisMax = useMemo(() => {
    if (chartData.length === 0) return 1;
    const stackedMax = Math.max(...chartData.map((d) => d.fission + d.fusion + d.oracle));
    const npMax = showTransmuteEstimate ? Math.max(...chartData.map((d) => d.transmuteNeutronToProton)) : 0;
    const pnMax = showTransmuteEstimate ? Math.max(...chartData.map((d) => d.transmuteProtonToNeutron)) : 0;
    const maxTotal = Math.max(stackedMax, npMax, pnMax);
    if (maxTotal <= 0) return 1;
    // Round up to a clean value
    const magnitude = Math.pow(10, Math.floor(Math.log10(maxTotal)));
    return Math.ceil(maxTotal / magnitude) * magnitude;
  }, [chartData, showTransmuteEstimate]);

  // ── Last point for header summary ──────────────────────────────────────
  const lastPoint = chartData.length > 0 ? chartData[chartData.length - 1] : null;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="mt-6 rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-[#141414] p-5">
      {/* Header row */}
      <div className="mb-4 flex items-start justify-between flex-wrap gap-3">
        {/* Left group */}
        <div className="flex flex-col gap-2 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Protocol Fee Accumulation
            </h3>
            <span className="text-xs font-normal text-gray-400 dark:text-white/40">
              exact fees only · transmutation fee is estimated †
            </span>
            {isSparse && (
              <span className="text-xs font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
                Showing all {points.length} available snapshots
              </span>
            )}
          </div>
          {/* Running totals badge row */}
          {lastPoint && !loading && (
            <div className="flex items-center flex-wrap gap-2 mt-0.5">
              <StatPill
                label="Fission"
                value={lastPoint.fission}
                colorClass="text-indigo-500 bg-indigo-500/10 border-indigo-500/20"
              />
              <StatPill
                label="Fusion"
                value={lastPoint.fusion}
                colorClass="text-amber-500 bg-amber-500/10 border-amber-500/20"
              />
              {showTransmuteEstimate && (
                <>
                  <StatPill
                    label={`Transmutation (${tokenConfig.stableAsset.symbol} → ${tokenConfig.volatileAsset.symbol})`}
                    value={lastPoint.transmuteNeutronToProton}
                    colorClass="text-purple-400 bg-purple-500/10 border-purple-500/20"
                    isEstimate
                  />
                  <StatPill
                    label={`Transmutation (${tokenConfig.volatileAsset.symbol} → ${tokenConfig.stableAsset.symbol})`}
                    value={lastPoint.transmuteProtonToNeutron}
                    colorClass="text-pink-400 bg-pink-500/10 border-pink-500/20"
                    isEstimate
                  />
                </>
              )}
              <StatPill
                label="Oracle"
                value={lastPoint.oracle}
                colorClass="text-teal-500 bg-teal-500/10 border-teal-500/20"
              />
              <StatPill
                label="Total"
                value={
                  lastPoint.total -
                  (showTransmuteEstimate
                    ? 0
                    : lastPoint.estimatedNeutronToProton + lastPoint.estimatedProtonToNeutron)
                }
                colorClass="text-gray-900 dark:text-white bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10"
                bold
              />

              {/* Transmutation estimate toggle */}
              <button
                type="button"
                onClick={() => setShowTransmuteEstimate((v) => !v)}
                className={[
                  "rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors border",
                  showTransmuteEstimate
                    ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                    : "text-gray-400 dark:text-white/40 border-gray-200 dark:border-white/10 hover:text-gray-600 dark:hover:text-white/60",
                ].join(" ")}
              >
                {showTransmuteEstimate ? "Hide" : "Show"} transmutation estimate
              </button>
            </div>
          )}
        </div>

        {/* Right side: Time range toggle */}
        <div className="flex rounded-lg bg-gray-100 dark:bg-white/5 p-0.5 self-start">
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

      {/* Chart area */}
      <div className="h-56 w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400 dark:text-white/40" />
            <span className="text-xs text-gray-400 dark:text-white/40">
              Reconstructing fee history from on-chain box data…
            </span>
          </div>
        ) : error && chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-red-400 text-center max-w-sm">{error}</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-gray-400 dark:text-white/40 text-center">
              No fee data in this range — only {points.length} protocol transitions exist
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs>
                {/* Fission — indigo */}
                <linearGradient id="cfFission" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                </linearGradient>
                {/* Fusion — amber */}
                <linearGradient id="cfFusion" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                </linearGradient>
                {/* Oracle — teal */}
                <linearGradient id="cfOracle" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.05} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)"}
                vertical={false}
              />

              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={timeDomain}
                ticks={xTicks.length > 0 ? xTicks : undefined}
                tickFormatter={tickFormatter}
                tick={{ fill: isDark ? "rgba(255,255,255,0.3)" : "#6b7280", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                domain={[0, yAxisMax]}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(1)
                }
                tick={{ fill: isDark ? "rgba(255,255,255,0.3)" : "#6b7280", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />

              <RechartsTooltip content={<CustomTooltip />} />

              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value: string) => {
                  if (value === "transmuteNeutronToProton")
                    return `Transmutation (${tokenConfig.stableAsset.symbol} → ${tokenConfig.volatileAsset.symbol}) † (est.)`;
                  if (value === "transmuteProtonToNeutron")
                    return `Transmutation (${tokenConfig.volatileAsset.symbol} → ${tokenConfig.stableAsset.symbol}) † (est.)`;
                  return value.charAt(0).toUpperCase() + value.slice(1);
                }}
              />

              {/* Stacked solid areas — exact fees */}
              <Area
                type="monotone"
                dataKey="fission"
                name="fission"
                stackId="exact"
                stroke="#6366f1"
                fill="url(#cfFission)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={true}
              />
              <Area
                type="monotone"
                dataKey="fusion"
                name="fusion"
                stackId="exact"
                stroke="#f59e0b"
                fill="url(#cfFusion)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={true}
              />
              <Area
                type="monotone"
                dataKey="oracle"
                name="oracle"
                stackId="exact"
                stroke="#14b8a6"
                fill="url(#cfOracle)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={true}
              />

              {/* Dashed lines — transmutation dilution estimates (not stacked, togglable) */}
              {showTransmuteEstimate && (
                <>
                  <Line
                    type="monotone"
                    dataKey="transmuteNeutronToProton"
                    name="transmuteNeutronToProton"
                    stroke="#a78bfa"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    dot={false}
                    isAnimationActive={true}
                    legendType="plainline"
                  />
                  <Line
                    type="monotone"
                    dataKey="transmuteProtonToNeutron"
                    name="transmuteProtonToNeutron"
                    stroke="#f472b6"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    dot={false}
                    isAnimationActive={true}
                    legendType="plainline"
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footnote row */}
      <div className="mt-2 flex justify-between items-end flex-wrap gap-1">
        <p className="text-[10px] text-gray-400 dark:text-white/25">
          † Transmutation fee: rate-based estimate (varPhiBeta × transmuted vol). All other lines are exact.
          Oracle fees exact given token price at each block.
        </p>
        <p className="text-[10px] text-gray-400 dark:text-white/25 text-right">
          Dates are block-height estimates (±2 min/block)
        </p>
      </div>
    </div>
  );
}

// ─── Small stat pill shown in header ─────────────────────────────────────────

function StatPill({
  label,
  value,
  colorClass,
  isEstimate,
  bold,
}: {
  label: string;
  value: number;
  colorClass: string;
  isEstimate?: boolean;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-md border px-2 py-0.5 ${colorClass}`}
    >
      <span className="text-[10px] text-gray-500 dark:text-white/40">{label}</span>
      <span className={`text-xs ${bold ? "font-bold" : "font-medium"}`}>
        {value.toFixed(2)} ERG{isEstimate ? " †" : ""}
      </span>
    </div>
  );
}
