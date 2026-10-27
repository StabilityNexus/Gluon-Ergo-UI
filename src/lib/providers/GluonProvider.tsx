/**
 * @file GluonProvider.tsx
 * @description Gluon protocol React context provider managing client, snapshot, and chain state.
 * @module lib/providers
 */
import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GluonClient, type GluonDeployment, type ProtocolSnapshot, type ChainState, type GluonError } from "@stability-nexus/gluon-ergo-sdk";
import { env } from "@/config/env";
import { PRESENTATION, type Presentation } from "@/config/presentation";

export interface GluonContextValue {
  deployment: GluonDeployment;
  presentation: Presentation;
  client: GluonClient;
  chain?: ChainState;
  snapshot?: ProtocolSnapshot;
  status: "loading" | "ready" | "error";
  error?: GluonError | Error;
  refresh: () => Promise<void>;
}

export const GluonContext = createContext<GluonContextValue | null>(null);

export interface GluonProviderProps {
  children: React.ReactNode;
  client?: GluonClient;
  pollIntervalMs?: number;
}

export function GluonProvider({ children, client: customClient, pollIntervalMs = 30000 }: GluonProviderProps) {
  const deployment = env.deployment;
  const presentation = useMemo(() => PRESENTATION[env.deploymentName] || PRESENTATION["gluon-gold-v3"], []);

  const client = useMemo(() => {
    if (customClient) return customClient;
    return new GluonClient({
      deployment: env.deployment,
      nodeUrl: env.nodeUrl,
    });
  }, [customClient]);

  const [chain, setChain] = useState<ChainState | undefined>(undefined);
  const [snapshot, setSnapshot] = useState<ProtocolSnapshot | undefined>(undefined);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<GluonError | Error | undefined>(undefined);

  const isMountedRef = useRef(true);
  const isRefreshingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;

    try {
      const newChain = await client.fetchChainState();
      const newSnapshot = await client.snapshot(newChain);

      if (!isMountedRef.current) return;
      setChain(newChain);
      setSnapshot(newSnapshot);
      setStatus("ready");
      setError(undefined);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      console.error("GluonProvider refresh error:", err);
      // Keep last good state on error, set status to error
      setError(err instanceof Error ? err : new Error(String(err)));
      setStatus("error");
    } finally {
      isRefreshingRef.current = false;
    }
  }, [client]);

  useEffect(() => {
    isMountedRef.current = true;
    refresh();

    let timer: ReturnType<typeof setInterval> | null = null;

    const startTimer = () => {
      if (!timer && pollIntervalMs > 0) {
        timer = setInterval(() => {
          if (typeof document !== "undefined" && document.visibilityState === "hidden") {
            return; // Pause polling while tab is hidden
          }
          refresh();
        }, pollIntervalMs);
      }
    };

    const stopTimer = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
        startTimer();
      } else {
        stopTimer();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
    startTimer();

    return () => {
      isMountedRef.current = false;
      stopTimer();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [refresh, pollIntervalMs]);

  const value = useMemo<GluonContextValue>(
    () => ({
      deployment,
      presentation,
      client,
      chain,
      snapshot,
      status,
      error,
      refresh,
    }),
    [deployment, presentation, client, chain, snapshot, status, error, refresh]
  );

  return <GluonContext.Provider value={value}>{children}</GluonContext.Provider>;
}
