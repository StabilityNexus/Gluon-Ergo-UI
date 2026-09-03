/**
 * @file ProtonAPYBadge.tsx
 * @description Rolling APY badge for the Proton (volatile) token. Stores price
 * history in localStorage and computes 30/60/90-day annualised yields. Renders
 * as a flat inline row with a Radix tooltip breakdown — no Lottie, no glow.
 * @module frontend/components/blocks/dashboard
 */
"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/lib/components/ui/tooltip";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Must match the read key exactly. */
const HISTORY_KEY = "gluon_proton_history";
const POLL_INTERVAL_MS = 30_000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

// ─── Types ────────────────────────────────────────────────────────────────────

interface BackingEntry {
  ts: number;
  value: number;
}

type WindowKey = "30D" | "60D" | "90D";

interface APYBreakdown {
  feeYield: number | null;
  combined: number | null;
}

// ─── LocalStorage ─────────────────────────────────────────────────────────────

function loadHistory(): BackingEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as BackingEntry[]) : [];
  } catch {
    return [];
  }
}

function pruneAndSave(entries: BackingEntry[]): BackingEntry[] {
  const cutoff = Date.now() - NINETY_DAYS_MS;
  const pruned = entries.filter((e) => e.ts >= cutoff);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(pruned));
  } catch {
    /* storage full */
  }
  return pruned;
}

// ─── APY helpers ──────────────────────────────────────────────────────────────

const WINDOW_DAYS: Record<WindowKey, number> = { "30D": 30, "60D": 60, "90D": 90 };

function calcAPY(current: number, past: number, windowDays: number): number | null {
  if (!past || past <= 0) return null;
  return (Math.pow(current / past, 365 / windowDays) - 1) * 100;
}

function findClosest(history: BackingEntry[], targetMs: number): BackingEntry | null {
  if (!history.length) return null;
  return history.reduce((best, e) =>
    Math.abs(e.ts - targetMs) < Math.abs(best.ts - targetMs) ? e : best
  );
}

/**
 * Returns true when we have at least `minPoints` entries in the entire history
 * (regardless of whether they span the full window).
 */
function hasMinData(history: BackingEntry[], minPoints: number = 2): boolean {
  return history.length >= minPoints;
}

// ─── Animated number ──────────────────────────────────────────────────────────

function AnimatedNumber({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => v.toFixed(2));
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const ctrl = animate(mv, value, { duration: 1.2, ease: "easeOut" });
    return ctrl.stop;
  }, [value, mv]);

  useEffect(() => {
    return display.on("change", (v) => {
      if (ref.current) ref.current.textContent = v + "%";
    });
  }, [display]);

  return <span ref={ref}>{value.toFixed(2)}%</span>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProtonAPYBadge() {
  const [mounted, setMounted] = useState(false);
  const [history, setHistory] = useState<BackingEntry[]>([]);
  const [currentValue, setCurrentValue] = useState<number | null>(null);
  const [leverage, setLeverage] = useState<number | null>(null);
  const [apr, setApr] = useState<number | null>(null);
  const [activeWindow, setActiveWindow] = useState<WindowKey>("30D");
  const [breakdown, setBreakdown] = useState<APYBreakdown>({
    feeYield: null,
    combined: null,
  });

  // Mount: read existing history and clear invalid entries
  useEffect(() => {
    setMounted(true);
    // Clear proton backing entries with value <= 0 or NaN
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const existing: BackingEntry[] = JSON.parse(raw);
        const invalid = existing.some(
          (e) => !e.value || isNaN(e.value) || e.value <= 0
        );
        if (invalid) localStorage.removeItem(HISTORY_KEY);
      }
    } catch { /* ignore */ }
    // Clear reserve history entries that are raw BigInt values (> 1000) or decimals (< 1)
    try {
      const raw = JSON.parse(localStorage.getItem("gluon_reserve_history") || "[]");
      let cleaned = (raw as { ratio: number; timestamp: number }[]).filter(
        (e) => e.ratio >= 1 && e.ratio <= 1000
      );
      
      const currentApprox = cleaned[cleaned.length - 1]?.ratio ?? 0;
      if (currentApprox < 80) {
        cleaned = cleaned.filter(e => e.timestamp >= Date.now() - 3 * 24 * 60 * 60 * 1000);
      }
      
      if (cleaned.length !== raw.length) {
        localStorage.setItem("gluon_reserve_history", JSON.stringify(cleaned));
      }
    } catch { /* ignore */ }
  }, []);

  // Poll proton price every 30 s
  useEffect(() => {
    let live = true;

    async function poll() {
      try {
        const sdk = await import("gluon-ergo-sdk");
        const gluon = new sdk.Gluon();
        gluon.config.NETWORK = process.env.NEXT_PUBLIC_DEPLOYMENT || "testnet";
        gluon.config.NODE_URL = process.env.NEXT_PUBLIC_NODE_URL || "https://node.ergopool.io/";
        const [gluonBox, oracleBox] = await Promise.all([
          gluon.getGluonBox(),
          gluon.getOracleBox(),
        ]);
        const rawPrice = await gluonBox.protonPrice(oracleBox);
        const normalizedReserveRatio = await gluon.getReserveRatio(gluonBox, oracleBox);
        const currentLeverage = Math.round(- (100 / (100 - normalizedReserveRatio)) * 100) / 100;
        setLeverage(currentLeverage);
        
        // Guard: BigInt silently becomes null in JSON.stringify — always convert to Number
        const value = typeof rawPrice === 'bigint' ? Number(rawPrice) / 1e9 : Number(rawPrice) / 1e9;
        if (!live || isNaN(value) || value <= 0) return;
        setCurrentValue(value);
        const existing = loadHistory();
        const lastEntry = existing[existing.length - 1];
        const hasChanged = !lastEntry || Math.abs(lastEntry.value - value) > 0.0001;
        const isFirstEntry = existing.length === 0;
        
        let updated = history;
        if (hasChanged || isFirstEntry) {
          updated = pruneAndSave([...existing, { ts: Date.now(), value }]);
          setHistory(updated);
        }

        // Fee yield: compute from reserve ratio growth stored in gluon_reserve_history.
        // The GAUC price barely changes between polls — reserve ratio growth is the
        // reliable proxy for fee accumulation yield.
        let feeYield: number | null = null;
        let aprValue: number | null = null;
        try {
          const reserveRaw = localStorage.getItem("gluon_reserve_history");
          if (reserveRaw) {
            const reserveHistory: { timestamp: number; ratio: number }[] =
              JSON.parse(reserveRaw);
            if (reserveHistory.length >= 2) {
              const latest = reserveHistory[reserveHistory.length - 1];
              const days = WINDOW_DAYS[activeWindow];
              const targetMs = latest.timestamp - days * 86_400_000;
              const past = reserveHistory.reduce((best, e) =>
                Math.abs(e.timestamp - targetMs) <
                Math.abs(best.timestamp - targetMs)
                  ? e
                  : best
              );
              if (past && past.ratio > 0 && latest.ratio > 0) {
                const daysDiff = (latest.timestamp - past.timestamp) / 86_400_000 || 1;
                feeYield = latest.ratio > past.ratio
                  ? (Math.pow(latest.ratio / past.ratio, 365 / daysDiff) - 1) * 100
                  : 0;
                aprValue = latest.ratio > past.ratio
                  ? ((latest.ratio / past.ratio) - 1) * (365 / daysDiff) * 100
                  : 0;
                
                // If APY is extreme (reserve crash, not fee movement), suppress it
                if (feeYield < -50 || feeYield > 200) {
                  feeYield = 0;
                  aprValue = 0;
                }
              }
            }
          }
        } catch { /* fallback to GAUC-based APY */ }

        // If reserve history unavailable, fall back to proton price history
        if (feeYield === null) {
          const days = WINDOW_DAYS[activeWindow];
          const past = findClosest(updated, Date.now() - days * 86_400_000);
          if (past && hasMinData(updated)) {
            feeYield = calcAPY(value, past.value, days);
            const daysDiff = (Date.now() - past.ts) / 86_400_000 || 1;
            aprValue = ((value / past.value) - 1) * (365 / daysDiff) * 100;
          }
        }
        
        setApr(aprValue);

        setBreakdown({
          feeYield,
          combined: feeYield,
        });
      } catch (err) {
        console.error("[ProtonAPYBadge]", err);
      }
    }

    const seeded = loadHistory();
    if (seeded.length) setHistory(seeded);
    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      live = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute when window changes
  useEffect(() => {
    if (!currentValue || !history.length) return;
    const days = WINDOW_DAYS[activeWindow];
    const past = findClosest(history, Date.now() - days * 86_400_000);
    const feeYield =
      past && hasMinData(history) ? calcAPY(currentValue, past.value, days) : null;
    setBreakdown((prev) => ({
      ...prev,
      feeYield,
      combined: feeYield,
    }));
  }, [activeWindow, history, currentValue]);

  const displayAPY = breakdown.feeYield;
  /** True when APY is available and non-trivially non-zero. */
  const hasData = displayAPY !== null && Math.abs(displayAPY) > 0.001;
  /** True when we have at least 2 stored data points. */
  const hasEnough = hasMinData(history);
  /** True when there are enough points but fewer than a full 30-day window. */
  const isEarlyEstimate = hasEnough && history.length < 30;
  /** True when APY computed to exactly 0 — price hasn't moved yet. */
  const isZeroMovement = breakdown.feeYield !== null && !hasData;

  return (
    <div
      className="transition-opacity duration-300"
      style={{ opacity: mounted ? 1 : 0 }}
      aria-label="Proton APY"
    >
      {/* Row */}
      <div className="mt-3 flex flex-col gap-2">
        {/* Badge row */}
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex cursor-default items-center gap-2">
                {!hasEnough ? (
                  <span className="text-sm font-semibold text-gray-400 dark:text-white/40">
                    Accumulating data...
                  </span>
                ) : (
                  <div className="flex items-center gap-3">
                    {/* APY section */}
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {displayAPY !== null ? (isZeroMovement ? "—" : `${displayAPY.toFixed(2)}%`) : "—"}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-white/40">APY</span>
                    </div>
                    {/* Divider */}
                    {leverage !== null && (
                      <>
                        <span className="text-gray-200 dark:text-white/10">|</span>
                        {/* Leverage section */}
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {leverage.toFixed(2)}x
                          </span>
                          <span className="text-xs text-gray-400 dark:text-white/40">Leverage</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {isEarlyEstimate && hasData && (
                  <span className="ml-1 text-xs text-gray-400 dark:text-white/30">Early estimate</span>
                )}
              </div>
            </TooltipTrigger>

            {/* Tooltip */}
            <TooltipContent
              side="bottom"
              className="w-72 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1e1e1e] p-3 shadow-none"
            >
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-gray-400 dark:text-white/40">
                APY Breakdown — {activeWindow}
              </p>
              <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-3 mt-1">
                <span className="text-xs text-gray-500 dark:text-white/40">Fee Accumulation APY</span>
                <span className="text-xs font-semibold text-gray-900 dark:text-white text-right">
                  {displayAPY !== null
                    ? displayAPY.toFixed(2) + "%"
                    : "Accumulating..."}
                </span>

                <div className="flex flex-col border-t border-gray-100 dark:border-white/[0.07] pt-2">
                  <span className="text-xs text-gray-500 dark:text-white/40">
                    ERG Price Leverage (live)
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-white/30 mt-0.5">
                    Updates with oracle, independent of time window
                  </span>
                </div>
                <span className="text-xs font-semibold text-gray-900 dark:text-white text-right border-t border-gray-100 dark:border-white/[0.07] pt-2">
                  {leverage !== null ? `${leverage.toFixed(2)}x — GAUC moves ~${leverage.toFixed(1)}x per 1% ERG move` : "—"}
                </span>

                <span className="text-xs text-gray-500 dark:text-white/40 border-t border-gray-100 dark:border-white/[0.07] pt-2">
                  Yield Sources
                </span>
                <span className="text-xs text-gray-400 dark:text-white/30 leading-relaxed text-right border-t border-gray-100 dark:border-white/[0.07] pt-2 col-span-2">
                  Every fission/fusion/transmutation adds fees to the reserve, increasing GAUC backing. Leverage amplifies ERG price exposure.
                </span>

                <span className="text-xs text-gray-500 dark:text-white/40 border-t border-gray-100 dark:border-white/[0.07] pt-2">
                  Simple APR (non-compounded)
                </span>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 text-right border-t border-gray-100 dark:border-white/[0.07] pt-2">
                  {apr !== null ? `${apr.toFixed(2)}%` : "—"}
                </span>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Window toggle */}
        <div
          className="flex rounded-lg bg-gray-100 dark:bg-white/5 p-0.5 w-fit"
          role="group"
          aria-label="APY time window"
        >
          {(["30D", "60D", "90D"] as WindowKey[]).map((w) => (
            <button
              key={w}
              id={`proton-apy-window-${w}`}
              onClick={() => setActiveWindow(w)}
              aria-pressed={activeWindow === w}
              className={[
                "rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors duration-150",
                activeWindow === w
                  ? "bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white"
                  : "text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/60",
              ].join(" ")}
            >
              {w}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
