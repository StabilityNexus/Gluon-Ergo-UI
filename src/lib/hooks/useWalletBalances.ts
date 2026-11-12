/**
 * @file useWalletBalances.ts
 * @description Hook managing wallet UTXO balances with polling, visibility pausing, and error recovery.
 * @module lib/hooks
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { Amount, Box } from "@fleet-sdk/common";
import { useErgo } from "@/lib/providers/ErgoProvider";
import { sumBalances, type WalletBalances } from "@/lib/functions/reactor/balances";

export interface UseWalletBalancesOptions {
  /**
   * Interval for background balance polling in milliseconds.
   * Default: 30000 (interval value taken from the earlier report).
   */
  pollIntervalMs?: number;
  /**
   * Optional custom UTXO fetcher (used in tests or specific wallet contexts).
   */
  getUtxosOverride?: () => Promise<Box<Amount>[]>;
}

export type BalanceStatus = "idle" | "loading" | "ready" | "error";

export interface UseWalletBalancesResult {
  balances: WalletBalances | undefined;
  status: BalanceStatus;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * React hook to retrieve and subscribe to the connected wallet's aggregated balances.
 *
 * Polling interval defaults to 30 000 ms (interval value taken from the earlier report).
 * Automatically pauses polling while the page is hidden, resets state on disconnect,
 * and preserves the last known good balance if a periodic refresh encounters an error.
 *
 * @param options Configuration options for polling frequency and UTXO provider.
 * @returns {UseWalletBalancesResult} Aggregated balances, status, error, and manual refresh function.
 */
export function useWalletBalances(options?: UseWalletBalancesOptions): UseWalletBalancesResult {
  const { isConnected, isRestoringConnection, getUtxos: ergoGetUtxos } = useErgo();
  const getUtxos = options?.getUtxosOverride ?? ergoGetUtxos;
  const pollIntervalMs = options?.pollIntervalMs ?? 30000;

  const [balances, setBalances] = useState<WalletBalances | undefined>(undefined);
  const [status, setStatus] = useState<BalanceStatus>("idle");
  const [error, setError] = useState<Error | null>(null);

  // Counter to guard against out-of-order stale async resolutions
  const fetchCounterRef = useRef(0);

  const fetchBalances = useCallback(async (): Promise<void> => {
    if (!isConnected || isRestoringConnection) {
      return;
    }

    const currentFetchId = ++fetchCounterRef.current;
    queueMicrotask(() => {
      if (currentFetchId === fetchCounterRef.current) {
        setStatus((prev) => (prev === "ready" || prev === "error" ? prev : "loading"));
      }
    });

    try {
      const boxes = await getUtxos();
      const summed = sumBalances(boxes);

      if (currentFetchId === fetchCounterRef.current) {
        setBalances(summed);
        setStatus("ready");
        setError(null);
      }
    } catch (err: unknown) {
      if (currentFetchId === fetchCounterRef.current) {
        // Keeps the last good balance value if one exists
        setStatus("error");
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }, [isConnected, isRestoringConnection, getUtxos]);

  const isAvailable = isConnected && !isRestoringConnection;

  useEffect(() => {
    if (!isAvailable) {
      return;
    }

    // Initial fetch when connected
    queueMicrotask(() => {
      void fetchBalances();
    });

    const intervalId = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      void fetchBalances();
    }, pollIntervalMs);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchBalances();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
    }

    return () => {
      clearInterval(intervalId);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
    };
  }, [isAvailable, fetchBalances, pollIntervalMs]);

  return {
    balances: isAvailable ? balances : undefined,
    status: isAvailable ? status : "idle",
    error: isAvailable ? error : null,
    refresh: fetchBalances,
  };
}
