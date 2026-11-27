/**
 * @file ProtonAPYBadge.tsx
 * @description Rolling APY badge for the Proton (volatile) token. Reads proton price and
 * leverage from GluonProvider, stores price history in deployment-scoped localStorage, and
 * computes 30/60/90-day annualised yields.
 * @module lib/components/blocks/dashboard
 */
"use client";

import { useEffect, useState, useMemo, useSyncExternalStore } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/lib/components/ui/tooltip";
import { useGluon } from "@/lib/hooks/useGluon";
import { formatUnits } from "@/lib/utils/amounts";

interface BackingEntry {
  ts: number;
  value: number;
}

type WindowKey = "30D" | "60D" | "90D";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const WINDOW_DAYS: Record<WindowKey, number> = { "30D": 30, "60D": 60, "90D": 90 };
const EMPTY_HISTORY: BackingEntry[] = [];
const historyListeners = new Set<() => void>();

let cachedKey = "";
let cachedRaw: string | null = null;
let cachedEntries: BackingEntry[] = EMPTY_HISTORY;

const emptySubscribe = () => () => {};
const getClientMounted = () => true;
const getServerMounted = () => false;
const getServerHistory = () => EMPTY_HISTORY;

function subscribeHistory(callback: () => void): () => void {
  historyListeners.add(callback);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", callback);
  }
  return () => {
    historyListeners.delete(callback);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", callback);
    }
  };
}

function notifyHistoryListeners(): void {
  for (const listener of historyListeners) {
    listener();
  }
}

function getHistorySnapshot(storageKey: string): BackingEntry[] {
  if (typeof window === "undefined") return EMPTY_HISTORY;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === cachedRaw && storageKey === cachedKey) {
      return cachedEntries;
    }
    cachedKey = storageKey;
    cachedRaw = raw;
    if (!raw) {
      cachedEntries = EMPTY_HISTORY;
      return cachedEntries;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      cachedEntries = EMPTY_HISTORY;
      return cachedEntries;
    }
    cachedEntries = parsed.filter(
      (e): e is BackingEntry =>
        typeof e === "object" &&
        e !== null &&
        Number.isFinite((e as BackingEntry).value) &&
        (e as BackingEntry).value > 0 &&
        Number.isFinite((e as BackingEntry).ts)
    );
    return cachedEntries;
  } catch {
    return EMPTY_HISTORY;
  }
}

function pruneAndSave(storageKey: string, entries: BackingEntry[]): void {
  const cutoff = Date.now() - NINETY_DAYS_MS;
  const pruned = entries.filter((e) => e.ts >= cutoff);
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(pruned));
    notifyHistoryListeners();
  } catch {
    /* storage unavailable or full */
  }
}

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

export function ProtonAPYBadge() {
  const { snapshot, deployment } = useGluon();
  const mounted = useSyncExternalStore(emptySubscribe, getClientMounted, getServerMounted);
  const [activeWindow, setActiveWindow] = useState<WindowKey>("30D");

  const protonName = deployment.tokens.proton.name;
  const storageKey = `gluon_proton_history:${deployment.name}`;

  const history = useSyncExternalStore(
    subscribeHistory,
    () => getHistorySnapshot(storageKey),
    getServerHistory
  );

  const currentValue = useMemo(() => {
    if (!snapshot) return null;
    const num = Number(formatUnits(snapshot.protonPrice, 9));
    return Number.isFinite(num) && num > 0 ? num : null;
  }, [snapshot]);

  const leverage = snapshot?.protonLeverage ?? null;

  useEffect(() => {
    if (!mounted || currentValue === null) return;
    const existing = getHistorySnapshot(storageKey);
    const lastEntry = existing[existing.length - 1];
    const hasChanged = !lastEntry || Math.abs(lastEntry.value - currentValue) > 0.0001;
    if (hasChanged || existing.length === 0) {
      pruneAndSave(storageKey, [...existing, { ts: Date.now(), value: currentValue }]);
    }
  }, [mounted, currentValue, storageKey]);

  const { displayAPY, apr } = useMemo(() => {
    if (currentValue === null || history.length < 2) {
      return { displayAPY: null, apr: null };
    }
    const days = WINDOW_DAYS[activeWindow];
    const now = history[history.length - 1].ts;
    const past = findClosest(history, now - days * 86_400_000);
    if (!past || past.value <= 0) {
      return { displayAPY: null, apr: null };
    }
    const apy = calcAPY(currentValue, past.value, days);
    const daysDiff = Math.max(1, (now - past.ts) / 86_400_000);
    const aprValue = ((currentValue / past.value) - 1) * (365 / daysDiff) * 100;
    return { displayAPY: apy, apr: aprValue };
  }, [currentValue, history, activeWindow]);

  const hasData = displayAPY !== null && Math.abs(displayAPY) > 0.001;
  const hasEnough = history.length >= 2;
  const isEarlyEstimate = hasEnough && history.length < 30;
  const isZeroMovement = displayAPY !== null && !hasData;

  return (
    <div
      className="transition-opacity duration-300"
      style={{ opacity: mounted ? 1 : 0 }}
      aria-label={`${protonName} APY`}
    >
      <div className="mt-3 flex flex-col gap-2">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex cursor-default items-center gap-2">
                {!hasEnough ? (
                  <span className="text-sm font-semibold text-muted-foreground">
                    Accumulating data…
                  </span>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                      <span className="text-sm font-semibold text-foreground">
                        {displayAPY !== null ? (isZeroMovement ? "—" : `${displayAPY.toFixed(2)}%`) : "—"}
                      </span>
                      <span className="text-xs text-muted-foreground">APY</span>
                    </div>
                    {leverage !== null && (
                      <>
                        <span className="text-border">|</span>
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          <span className="text-sm font-semibold text-foreground">
                            {leverage.toFixed(2)}x
                          </span>
                          <span className="text-xs text-muted-foreground">Leverage</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {isEarlyEstimate && hasData && (
                  <span className="ml-1 text-xs text-muted-foreground">Early estimate</span>
                )}
              </div>
            </TooltipTrigger>

            <TooltipContent
              side="bottom"
              className="w-72 rounded-lg border border-border bg-card p-3 shadow-none"
            >
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                APY Breakdown — {activeWindow}
              </p>
              <div className="mt-1 grid grid-cols-[1fr_auto] gap-x-6 gap-y-3">
                <span className="text-xs text-muted-foreground">Price Growth APY</span>
                <span className="text-right text-xs font-semibold text-foreground">
                  {displayAPY !== null ? `${displayAPY.toFixed(2)}%` : "Accumulating…"}
                </span>

                <div className="flex flex-col border-t border-border pt-2">
                  <span className="text-xs text-muted-foreground">ERG Price Leverage (live)</span>
                  <span className="mt-0.5 text-[10px] text-muted-foreground">
                    Updates with oracle, independent of time window
                  </span>
                </div>
                <span className="border-t border-border pt-2 text-right text-xs font-semibold text-foreground">
                  {leverage !== null
                    ? `${leverage.toFixed(2)}x — ${protonName} moves ~${leverage.toFixed(1)}x per 1% ERG move`
                    : "—"}
                </span>

                <span className="border-t border-border pt-2 text-xs text-muted-foreground">
                  Yield Sources
                </span>
                <span className="col-span-2 border-t border-border pt-2 text-right text-xs leading-relaxed text-muted-foreground">
                  Every fission, fusion, and transmutation adds fees to the reserve, increasing {protonName} backing. Leverage amplifies ERG price exposure.
                </span>

                <span className="border-t border-border pt-2 text-xs text-muted-foreground">
                  Simple APR (non-compounded)
                </span>
                <span className="border-t border-border pt-2 text-right text-xs font-semibold text-muted-foreground">
                  {apr !== null ? `${apr.toFixed(2)}%` : "—"}
                </span>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div
          className="flex w-fit rounded-lg bg-muted p-0.5"
          role="group"
          aria-label="APY time window"
        >
          {(["30D", "60D", "90D"] as WindowKey[]).map((w) => (
            <button
              key={w}
              type="button"
              id={`proton-apy-window-${w}`}
              onClick={() => setActiveWindow(w)}
              aria-pressed={activeWindow === w}
              className={[
                "rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors duration-150",
                activeWindow === w
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
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
