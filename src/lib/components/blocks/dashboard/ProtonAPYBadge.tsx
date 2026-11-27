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

export interface BackingEntry {
  ts: number;
  value: number;
}

type WindowKey = "30D" | "60D" | "90D";

export type WindowYieldResult =
  | { status: "insufficient" }
  | { status: "ok"; apy: number; apr: number; elapsedDays: number };

const DAY_MS = 86_400_000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * DAY_MS;
const ONE_HUNDRED_TWENTY_DAYS_MS = 120 * DAY_MS;
const WINDOW_DAYS: Record<WindowKey, number> = { "30D": 30, "60D": 60, "90D": 90 };
const EMPTY_HISTORY: BackingEntry[] = [];
const historyListeners = new Set<() => void>();

let cachedKey = "";
let cachedRaw: string | null = null;
let cachedEntries: BackingEntry[] = EMPTY_HISTORY;
let observedNowMs = 0;

const emptySubscribe = () => () => {};
const getClientMounted = () => true;
const getServerMounted = () => false;
const getServerHistory = () => EMPTY_HISTORY;
const getObservedNow = () => observedNowMs;
const getServerObservedNow = () => 0;

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

export function getHistorySnapshot(storageKey: string): BackingEntry[] {
  if (typeof window === "undefined") return EMPTY_HISTORY;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === cachedRaw && storageKey === cachedKey) {
      return cachedEntries;
    }
    if (!raw) {
      cachedKey = storageKey;
      cachedRaw = raw;
      cachedEntries = EMPTY_HISTORY;
      return cachedEntries;
    }
    const parsed = JSON.parse(raw) as unknown;
    const nextEntries = Array.isArray(parsed)
      ? parsed.filter(
          (e): e is BackingEntry =>
            typeof e === "object" &&
            e !== null &&
            Number.isFinite((e as BackingEntry).value) &&
            (e as BackingEntry).value > 0 &&
            Number.isFinite((e as BackingEntry).ts)
        )
      : EMPTY_HISTORY;

    cachedKey = storageKey;
    cachedRaw = raw;
    cachedEntries = nextEntries;
    return cachedEntries;
  } catch {
    cachedKey = "";
    cachedRaw = null;
    cachedEntries = EMPTY_HISTORY;
    return EMPTY_HISTORY;
  }
}

/**
 * Returns true when an observation should be recorded: either no history exists,
 * the price changed materially, or at least one hour has elapsed since the last entry.
 */
export function shouldRecordObservation(
  history: readonly BackingEntry[],
  currentValue: number,
  nowMs: number
): boolean {
  if (history.length === 0) return true;
  const last = history[history.length - 1];
  if (Math.abs(last.value - currentValue) > 0.0001) return true;
  return nowMs - last.ts >= ONE_HOUR_MS;
}

/**
 * Prunes entries older than ~120 days while always retaining the newest entry
 * at or before the longest window (90 days) so the 90D baseline is preserved.
 */
export function pruneHistory(
  entries: readonly BackingEntry[],
  nowMs: number
): BackingEntry[] {
  const pruneCutoff = nowMs - ONE_HUNDRED_TWENTY_DAYS_MS;
  const ninetyDayCutoff = nowMs - NINETY_DAYS_MS;

  let anchor: BackingEntry | null = null;
  for (const e of entries) {
    if (e.ts <= ninetyDayCutoff && (!anchor || e.ts > anchor.ts)) {
      anchor = e;
    }
  }

  const kept = entries.filter((e) => e.ts >= pruneCutoff);
  if (anchor && !kept.some((e) => e.ts === anchor.ts && e.value === anchor.value)) {
    return [anchor, ...kept].sort((a, b) => a.ts - b.ts);
  }
  return kept;
}

function pruneAndSave(storageKey: string, entries: readonly BackingEntry[], nowMs: number): void {
  const pruned = pruneHistory(entries, nowMs);
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(pruned));
    notifyHistoryListeners();
  } catch {
    /* storage unavailable or full */
  }
}

/**
 * Computes annualised APY and simple APR using the newest baseline observation
 * with ts <= nowMs - windowDays * 86_400_000 and the actual elapsed time to nowMs.
 */
export function computeWindowYield(
  history: readonly BackingEntry[],
  currentValue: number | null,
  nowMs: number,
  windowDays: number
): WindowYieldResult {
  if (
    currentValue === null ||
    !Number.isFinite(currentValue) ||
    currentValue <= 0 ||
    !Number.isFinite(nowMs) ||
    history.length === 0
  ) {
    return { status: "insufficient" };
  }

  const targetCutoff = nowMs - windowDays * DAY_MS;
  let baseline: BackingEntry | null = null;
  for (const entry of history) {
    if (entry.ts <= targetCutoff && (!baseline || entry.ts > baseline.ts)) {
      baseline = entry;
    }
  }

  if (!baseline || !Number.isFinite(baseline.value) || baseline.value <= 0) {
    return { status: "insufficient" };
  }

  const elapsedDays = (nowMs - baseline.ts) / DAY_MS;
  if (!Number.isFinite(elapsedDays) || elapsedDays <= 0) {
    return { status: "insufficient" };
  }

  const apy = (Math.pow(currentValue / baseline.value, 365 / elapsedDays) - 1) * 100;
  const apr = (currentValue / baseline.value - 1) * (365 / elapsedDays) * 100;

  if (!Number.isFinite(apy) || !Number.isFinite(apr)) {
    return { status: "insufficient" };
  }

  return { status: "ok", apy, apr, elapsedDays };
}

export function ProtonAPYBadge() {
  const { snapshot, deployment } = useGluon();
  const mounted = useSyncExternalStore(emptySubscribe, getClientMounted, getServerMounted);
  const nowMs = useSyncExternalStore(subscribeHistory, getObservedNow, getServerObservedNow);
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
    const observationTime = Date.now();
    observedNowMs = observationTime;
    const existing = getHistorySnapshot(storageKey);
    if (shouldRecordObservation(existing, currentValue, observationTime)) {
      pruneAndSave(storageKey, [...existing, { ts: observationTime, value: currentValue }], observationTime);
    } else {
      notifyHistoryListeners();
    }
  }, [mounted, currentValue, snapshot, storageKey]);

  const yieldResult = useMemo(() => {
    return computeWindowYield(history, currentValue, nowMs, WINDOW_DAYS[activeWindow]);
  }, [history, currentValue, nowMs, activeWindow]);

  const displayAPY = yieldResult.status === "ok" ? yieldResult.apy : null;
  const apr = yieldResult.status === "ok" ? yieldResult.apr : null;
  const hasEnough = yieldResult.status === "ok";
  const hasData = displayAPY !== null && Math.abs(displayAPY) > 0.001;
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
