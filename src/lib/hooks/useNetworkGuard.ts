/**
 * @file useNetworkGuard.ts
 * @description Hook checking the connected wallet's change address against Ergo mainnet with periodic and visibility re-checks.
 * @module lib/hooks
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useErgo } from "@/lib/providers/ErgoProvider";
import { useWalletOperations } from "@/lib/hooks/useWalletOperations";
import { isMainnetAddress } from "@/lib/functions/reactor/network";

export type NetworkGuardStatus = "unknown" | "mainnet" | "wrong-network";

export interface UseNetworkGuardOptions {
  /** Interval in milliseconds to re-check the wallet's change address. Default: 30000. */
  recheckMs?: number;
}

export interface UseNetworkGuardResult {
  status: NetworkGuardStatus;
  blocked: boolean;
  address?: string;
}

const DEFAULT_RECHECK_MS = 30000;

/**
 * React hook verifying whether the connected Ergo wallet is on mainnet by reading
 * its change address inside an effect (never during render).
 *
 * Returns "unknown" on the server, on first client render, while disconnected,
 * and whenever the address cannot be read (non-blocking).
 */
export function useNetworkGuard(options?: UseNetworkGuardOptions): UseNetworkGuardResult {
  const { isConnected, isInitialized, isRestoringConnection } = useErgo();
  const wallet = useWalletOperations();
  const recheckMs = options?.recheckMs ?? DEFAULT_RECHECK_MS;

  const isAvailable = isConnected && isInitialized && !isRestoringConnection;

  const [guardState, setGuardState] = useState<{
    status: NetworkGuardStatus;
    address?: string;
  }>({ status: "unknown" });

  // Counter invalidates stale async address checks across disconnects, unmounts, and newer runs.
  const checkCounterRef = useRef(0);

  const runCheck = useCallback(async (): Promise<void> => {
    if (!isAvailable) {
      return;
    }

    const currentCheckId = ++checkCounterRef.current;

    try {
      const addr = await wallet.getChangeAddress();
      if (currentCheckId !== checkCounterRef.current) {
        return;
      }

      if (typeof addr !== "string" || addr.trim().length === 0) {
        setGuardState({ status: "unknown", address: undefined });
        return;
      }

      setGuardState({
        status: isMainnetAddress(addr) ? "mainnet" : "wrong-network",
        address: addr,
      });
    } catch {
      if (currentCheckId === checkCounterRef.current) {
        setGuardState({ status: "unknown", address: undefined });
      }
    }
  }, [isAvailable, wallet]);

  useEffect(() => {
    if (!isAvailable) {
      const staleId = ++checkCounterRef.current;
      queueMicrotask(() => {
        if (checkCounterRef.current === staleId) {
          setGuardState({ status: "unknown", address: undefined });
        }
      });
      return;
    }

    queueMicrotask(() => {
      void runCheck();
    });

    const intervalId = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      void runCheck();
    }, recheckMs);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void runCheck();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
    }

    return () => {
      checkCounterRef.current += 1;
      clearInterval(intervalId);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
    };
  }, [isAvailable, runCheck, recheckMs]);

  const status: NetworkGuardStatus = isAvailable ? guardState.status : "unknown";
  const address = isAvailable ? guardState.address : undefined;

  return {
    status,
    blocked: status === "wrong-network",
    address,
  };
}

