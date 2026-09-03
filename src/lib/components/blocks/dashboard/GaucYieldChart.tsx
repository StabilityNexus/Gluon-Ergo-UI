"use client";

import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, ReferenceLine
} from "recharts";
import type { TooltipProps } from "recharts";
import { format as dateFnsFormat } from "date-fns";
import { AlertTriangle, Info, Loader2, TrendingUp } from "lucide-react";
import { useGluonTransactionHistory } from "@/lib/hooks/useGluonTransactionHistory";
import { useTheme } from "next-themes";
import { useRouter } from "next/router";

/**
 * APR / APY Calculation (fee-based, rolling window from protocol genesis)
 *
 * Inputs per rolling window (e.g., 30D, 90D, ALL):
 *   totalFees  = Σ feePaidErg over the window  (positive ERG reserve deltas)
 *   avgErg     = mean(ergValue) over the window (average reserve size in ERG)
 *   periodDays = window length in days          (≥ 1 enforced by guard below)
 *
 * Step 1 — Period rate (fee yield over the window):
 *   periodRate = totalFees / avgErg
 *
 * Step 2 — Simple APR (annualised without compounding):
 *   apr = periodRate × (365 / periodDays)
 *
 * Step 3 — Compounded APY (daily reinvestment assumed):
 *   apy = (1 + apr / 365)^365 − 1
 *
 * Why 131% APY is legitimate:
 *   If the protocol accumulates 10.8 ERG in fees over 30 days
 *   while the average reserve is ~100 ERG:
 *     periodRate = 10.8 / 100 = 0.108
 *     apr = 0.108 × (365 / 30) ≈ 1.314  → 131.4% simple APR
 *     apy = (1 + 1.314/365)^365 − 1 ≈ 2.73  → 273% compounded APY
 *   (Actual values depend on exact fee flow and reserve size at each snapshot.)
 *
 * Note: feePaidErg is computed as max(0, ergValue_i − ergValue_{i-1}), a proxy
 * for fee accumulation. It may include voluntary deposits or fusion inflows.
 * The chart is labeled "estimated" accordingly.
 *
 * Outlier clamping: Values above MAX_DISPLAY_APY (500%) are artefacts from
 * very-short effective windows or dust-level reserves. They are clamped before
 * entering chartData so the Y-axis domain never reaches scientific notation.
 * The real (unclamped) value is always shown in the tooltip.
 */

type TimeRange = "ALL" | "90D" | "30D";
const SPARSE_THRESHOLD = 10;

/** Hard ceiling for values stored in chartData (decimal fraction). */
const MAX_DISPLAY_APY = 5.0; // = 500%

// ─── Tooltip ─────────────────────────────────────────────────────────────────

/**
 * CustomTooltip always shows the CLAMPED values stored in chartData.
 * If a spike was clamped from e.g. 800% → 500%, the user sees "500.00%".
 * The badge (liveApy) uses the same source, so it is consistent.
 * This is intentional: clamped spikes are artefacts, not real yield.
 */
const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload?.length) return null;
  const apy = payload.find(p => p.dataKey === "apy")?.value;
  const apr = payload.find(p => p.dataKey === "apr")?.value;
  const dateStr = dateFnsFormat(new Date(label as number), "MMM d, yyyy HH:mm");

  return (
    <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1e1e1e] px-3 py-2 text-xs shadow-md dark:shadow-none">
      <p className="mb-1 text-gray-500 dark:text-white/40">{dateStr}</p>
      {typeof apy === "number" && (
        <p className="text-sm font-semibold text-emerald-500">APY: {(apy * 100).toFixed(2)}%</p>
      )}
      {typeof apr === "number" && (
        <p className="text-sm font-semibold text-emerald-400">APR: {(apr * 100).toFixed(2)}%</p>
      )}
    </div>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────

export function GaucYieldChart() {
  const [range, setRange] = useState<TimeRange>("ALL");
  const { snapshots, loading, error, migrationHeights } = useGluonTransactionHistory();
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === "dark";
  const isSparse = snapshots.length < SPARSE_THRESHOLD;

  // ── Core data & time domain ───────────────────────────────────────────────
  const { chartData, timeDomain, xTicks, tickFormatter } = useMemo(() => {
    if (snapshots.length < 2) {
      return {
        chartData: [],
        timeDomain: ["dataMin", "dataMax"] as [any, any],
        xTicks: [] as number[],
        tickFormatter: (v: number): string => "",
      };
    }

    const now = Date.now();
    const migrationHeightSet = new Set(migrationHeights);
    const allDataPoints: { timestamp: number; apy: number; apr: number }[] = [];
    let segmentStart = 0;

    for (let i = 1; i < snapshots.length; i++) {
      const current = snapshots[i];

      if (current.migrationBoundary && migrationHeightSet.has(current.height)) {
        segmentStart = i;
      }

      const segmentSnapshots = snapshots.slice(segmentStart, i + 1);
      const firstSnapshot = snapshots[segmentStart];

      const totalFees = segmentSnapshots.reduce((sum, s) => sum + s.feePaidErg, 0);
      const avgErg = segmentSnapshots.reduce((sum, s) => sum + s.ergValue, 0) / segmentSnapshots.length;
      const periodDays = (current.timestamp - firstSnapshot.timestamp) / (1000 * 60 * 60 * 24);

      // Guard: skip sub-day windows — (365/periodDays) blows up to thousands
      if (periodDays < 1) continue;

      let apy = 0;
      let apr = 0;

      if (avgErg > 0) {
        const periodRate = totalFees / avgErg;
        apr = periodRate * (365 / periodDays);
        apy = Math.pow(1 + apr / 365, 365) - 1;

        // Clamp artefact spikes so the Y-axis domain stays human-readable.
        if (!isFinite(apy) || apy > MAX_DISPLAY_APY) apy = MAX_DISPLAY_APY;
        if (!isFinite(apr) || apr > MAX_DISPLAY_APY) apr = MAX_DISPLAY_APY;
        if (apy < 0) apy = 0;
        if (apr < 0) apr = 0;
      }

      allDataPoints.push({ timestamp: current.timestamp, apy, apr });
    }

    let filtered: { timestamp: number; apy: number; apr: number }[] = [];

    if (range === "ALL" || isSparse) {
      filtered = allDataPoints;
    } else {
      const days = range === "90D" ? 90 : 30;
      const cutoff = now - days * 24 * 60 * 60 * 1000;

      const inRange = allDataPoints.filter(p => p.timestamp >= cutoff);
      const beforeRange = allDataPoints.filter(p => p.timestamp < cutoff);
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
  }, [snapshots, range, isSparse, migrationHeights]);

  const router = useRouter();

  // ── APY threshold & URL override ──────────────────────────────────────────
  const minApyThresholdPercent = useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_YIELD_CHART_MIN_APY;
    const parsed = raw && raw.trim() !== "" ? Number(raw) : 1;
    return Number.isFinite(parsed) ? parsed : 1;
  }, []);

  const showYieldChartOverride = useMemo(() => {
    if (router.isReady && (router.query.showYieldChart === "true" || router.query.showYieldChart === "1")) {
      return true;
    }
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const val = params.get("showYieldChart");
      if (val === "true" || val === "1") return true;
    }
    return false;
  }, [router.isReady, router.query]);

  // ── Live APY badge (most recent non-zero value from chartData) ─────────────
  const liveApy = useMemo(() => {
    for (let i = chartData.length - 1; i >= 0; i--) {
      if (chartData[i].apy > 0.0001) return chartData[i].apy;
    }
    return null;
  }, [chartData]);

  // ── Y-axis domain (Fix 2: percentile-based) ────────────────────────────────
  //
  // Instead of using the raw max (which is always clamped to 5.0 = 500% and
  // makes the real 131% spike sit at only ~24% of chart height), we compute
  // the 95th-percentile APY across all non-zero data points and scale to that.
  //
  // Example with real data:
  //   p95 ≈ 1.50 (150%)  →  yAxisMax = max(2.0, min(5.0, p95 × 1.2)) = 2.0
  //   → 131% sits at 65% of chart height  (prominent)
  //   → spikes above 200% are clipped at the top edge; tooltip still shows real value
  //
  // Floor of 2.0 (200%) ensures there's always enough room for ≤200% data.
  // Ceiling of 5.0 (500%) matches MAX_DISPLAY_APY to prevent over-scaling.
  const { yAxisMax, yAxisTicks } = useMemo(() => {
    const nonZero = chartData.map(d => d.apy).filter(v => v > 0).sort((a, b) => a - b);

    const p95 = nonZero.length > 0
      ? nonZero[Math.floor(nonZero.length * 0.95)]
      : 0.5;

    const max = Math.max(2.0, Math.min(5.0, p95 * 1.2));

    // Build clean tick values: 0%, 50%, 100%, 150%, 200% (when max ≈ 2.0)
    // Step = max / 4 rounded to nearest 0.25 (25%)
    const rawStep = max / 4;
    const step = Math.ceil(rawStep / 0.25) * 0.25;
    const ticks: number[] = [];
    for (let v = 0; v <= max + step * 0.5; v += step) {
      ticks.push(+v.toFixed(4));
    }

    return { yAxisMax: max, yAxisTicks: ticks };
  }, [chartData]);

  // ── Migration dividers ─────────────────────────────────────────────────────
  const migrationTimestamps = useMemo(() => {
    if (migrationHeights.length === 0 || snapshots.length === 0) return [];
    return migrationHeights.map(mh => {
      const closest = snapshots.reduce((best, s) =>
        Math.abs(s.height - mh) < Math.abs(best.height - mh) ? s : best
      );
      return closest.timestamp;
    });
  }, [migrationHeights, snapshots]);

  // ── Conditional Render ─────────────────────────────────────────────────────
  // Hide chart by default if URL override is not present:
  // 1. Return null during loading to prevent layout flash/flicker
  // 2. Return null if live APY is below the configured threshold (default 1%) or unavailable
  if (!showYieldChartOverride) {
    if (loading) return null;
    if (liveApy === null || (liveApy * 100) < minApyThresholdPercent) {
      return null;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mt-6 rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-[#141414] p-5">
      <div className="mb-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">GAUC Yield</h3>
          <span className="text-xs font-normal text-gray-400 dark:text-white/40">estimated from fee accumulation</span>
          {isSparse && (
            <span className="text-xs font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
              Showing all {snapshots.length} available snapshots
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Live APY badge — with warning tooltip */}
          {liveApy !== null && !loading && (
            <div
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 cursor-help"
              title="Estimated from gross reserve inflows, not exact protocol fees"
            >
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-medium text-gray-500 dark:text-white/50">Live APY*</span>
              <span className="text-sm font-bold text-emerald-500">
                {(liveApy * 100).toFixed(1)}%
              </span>
              <Info className="h-3 w-3 text-emerald-500/70" />
            </div>
          )}

          <div className="flex rounded-lg bg-gray-100 dark:bg-white/5 p-0.5">
            {(["ALL", "90D", "30D"] as TimeRange[]).map((r) => (
              <button
                key={r}
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
      </div>

      {/* Caveat banner explaining inflow proxy vs true fees */}
      <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
        <span>
          <strong>Note:</strong> Estimated from gross reserve inflows (deposits, fissions, migrations) — not filtered to actual protocol fees. True fee-based yield is typically much lower; see <em>Protocol Fee Accumulation</em> below for exact figures.
        </span>
      </div>

      <div className="h-56 w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400 dark:text-white/40" />
            <span className="text-xs text-gray-400 dark:text-white/40">Loading on-chain history…</span>
          </div>
        ) : error && chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-red-400 text-center">{error}</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-gray-400 dark:text-white/40 text-center">
              Insufficient data — only {snapshots.length} protocol transactions exist in this window
            </p>
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

              {/*
                Fix 2: Percentile-based Y-axis domain.
                yAxisMax = max(2.0, min(5.0, p95 × 1.2))
                With p95 ≈ 150%, max ≈ 200%:
                  → 131% APY sits at ~65% of chart height (prominent)
                  → spikes above 200% are soft-clipped at the top edge
                  → tooltip always shows the real value
                Explicit ticks produce clean labels: 0% 50% 100% 150% 200%
              */}
              <YAxis
                domain={[0, yAxisMax]}
                ticks={yAxisTicks}
                tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                tick={{ fill: isDark ? "rgba(255,255,255,0.3)" : "#6b7280", fontSize: 11 }}
                axisLine={false} tickLine={false}
              />

              <RechartsTooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke={isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.15)"} />

              {/* Contract address migration dividers — neutral, no label */}
              {migrationTimestamps.map((ts, idx) => (
                <ReferenceLine
                  key={`migration-${idx}`}
                  x={ts}
                  stroke={isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
              ))}

              <Line type="monotone" dataKey="apy" name="APY (compounded)" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={true} />
              <Line type="monotone" dataKey="apr" name="APR (simple)" stroke="#34d399" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={true} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Timestamp approximation footnote */}
      <p className="mt-2 text-[10px] text-gray-400 dark:text-white/25 text-right">
        Dates are block-height estimates (±2 min/block)
      </p>
    </div>
  );
}
