/**
 * @file useAdjustPeg.ts
 * @description Hook managing Adjust Peg state, user interaction flow, in-flight guards, and box emergence.
 * @module lib/hooks
 */

import { useState, useMemo, useCallback, useRef } from "react";
import { useGluon } from "@/lib/hooks/useGluon";
import { useErgo } from "@/lib/providers/ErgoProvider";
import { useWalletOperations } from "@/lib/hooks/useWalletOperations";
import {
  getAdjustPegState,
  type AdjustPegPhase,
  type AdjustPegState,
} from "@/lib/functions/reactor/adjustPegState";
import {
  handleAdjustPegStep,
  waitForReactorBox,
} from "@/lib/functions/reactor/handleAdjustPeg";

export interface UseAdjustPegOptions {
  networkBlocked?: boolean;
  pollMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export interface AdjustPegMessage {
  kind: "info" | "error";
  text: string;
}

export interface UseAdjustPegResult {
  state: AdjustPegState;
  directionText: "lowered" | "raised";
  remainingSteps: number;
  stepsDone: number;
  message?: AdjustPegMessage;
  run: () => Promise<void>;
  phase: AdjustPegPhase;
}

/**
 * Hook providing reactive state and interaction flow for the Adjust Peg card.
 *
 * Manages signing and waiting phases, polling for new reactor boxes, error messaging,
 * and double-click prevention via in-flight reference guard.
 *
 * @param options - Execution and network configuration options.
 * @returns State, labels, actions, and step progress.
 */
export function useAdjustPeg(options?: UseAdjustPegOptions): UseAdjustPegResult {
  const { client, chain, snapshot, status, error, refresh } = useGluon();
  const { isConnected, isInitialized, isRestoringConnection } = useErgo();
  const wallet = useWalletOperations();

  const walletReady = Boolean(isInitialized && !isRestoringConnection);

  const [phase, setPhase] = useState<AdjustPegPhase>("idle");
  const [stepsDone, setStepsDone] = useState<number>(0);
  const [lastTxId, setLastTxId] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState<AdjustPegMessage | undefined>(undefined);

  // Track previous healthy state during render to reset progress when a new unhealthy episode begins.
  // When snapshot.healthy transitions from true to false, an entirely new adjustment episode starts.
  const isHealthy = snapshot?.healthy;
  const [prevHealthy, setPrevHealthy] = useState<boolean | undefined>(isHealthy);

  const isNewUnhealthyEpisode = prevHealthy === true && isHealthy === false;
  if (prevHealthy !== isHealthy) {
    setPrevHealthy(isHealthy);
    if (isNewUnhealthyEpisode) {
      setStepsDone(0);
      setLastTxId(undefined);
      setMessage(undefined);
    }
  }

  const effectiveStepsDone = isNewUnhealthyEpisode ? 0 : stepsDone;
  const effectiveLastTxId = isNewUnhealthyEpisode ? undefined : lastTxId;
  const effectiveBaseMessage = isNewUnhealthyEpisode ? undefined : message;

  const inFlightRef = useRef(false);

  // Remaining steps calculated from quoteAdjustPeg
  const remainingSteps = useMemo(() => {
    if (!chain) return 0;
    try {
      const quote = client.quoteAdjustPeg(chain);
      return quote.allowed ? (quote.steps ?? 0) : 0;
    } catch {
      return 0;
    }
  }, [client, chain]);

  // Pure button and visibility state
  const state = useMemo(() => {
    return getAdjustPegState({
      snapshot,
      status,
      error,
      connected: isConnected,
      walletReady,
      networkBlocked: options?.networkBlocked,
      phase,
      stepsDone: effectiveStepsDone,
      remainingSteps,
    });
  }, [
    snapshot,
    status,
    error,
    isConnected,
    walletReady,
    options?.networkBlocked,
    phase,
    effectiveStepsDone,
    remainingSteps,
  ]);

  // Direction text derived from snapshot
  const directionText: "lowered" | "raised" =
    snapshot?.adjustPeg?.direction === "up" ? "raised" : "lowered";

  // Compute effective message in render: avoids any setState in effect bodies
  const derivedMessage: AdjustPegMessage | undefined = useMemo(() => {
    if (snapshot?.healthy) {
      if (effectiveStepsDone > 0) {
        return {
          kind: "info",
          text: "The reactor is healthy again; no peg adjustment is needed.",
        };
      }
      return undefined;
    }
    return effectiveBaseMessage;
  }, [snapshot?.healthy, effectiveStepsDone, effectiveBaseMessage]);

  const pollMs = options?.pollMs;
  const timeoutMs = options?.timeoutMs;
  const sleep = options?.sleep;
  const now = options?.now;

  const run = useCallback(async (): Promise<void> => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      if (state.action === "adjust") {
        setPhase("signing");
        setMessage(undefined);

        const res = await handleAdjustPegStep({
          client,
          refresh,
          wallet,
          pollMs,
          timeoutMs,
          sleep,
          now,
          onSubmitted: (txHash) => {
            setLastTxId(txHash);
            setPhase("waiting");
          },
        });

        if (!res.ok) {
          setPhase("idle");
          if (res.kind === "cancelled") {
            // User cancelled signing: stop silently with no message
          } else if (res.kind === "healthy") {
            setMessage({ kind: "info", text: res.message });
            try {
              await refresh();
            } catch {
              // Ignore refresh error
            }
          } else if (res.kind === "retry-later" || res.kind === "error") {
            setMessage({ kind: "error", text: res.message });
          }
        } else {
          setLastTxId(res.txHash);
          if (res.seen) {
            const nextDone = effectiveStepsDone + 1;
            setStepsDone(nextDone);
            setPhase("idle");
            setMessage({ kind: "info", text: `Step ${nextDone} done.` });
          } else {
            setPhase("timeout");
          }
        }
      } else if (state.action === "recheck") {
        if (!effectiveLastTxId) return;
        setPhase("waiting");

        const waitResult = await waitForReactorBox({
          refresh,
          txId: effectiveLastTxId,
          pollMs,
          timeoutMs,
          sleep,
          now,
        });

        if (waitResult.seen) {
          const nextDone = effectiveStepsDone + 1;
          setStepsDone(nextDone);
          setPhase("idle");
          setMessage({ kind: "info", text: `Step ${nextDone} done.` });
        } else {
          setPhase("timeout");
        }
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [
    state.action,
    client,
    refresh,
    wallet,
    pollMs,
    timeoutMs,
    sleep,
    now,
    effectiveStepsDone,
    effectiveLastTxId,
  ]);

  return {
    state,
    directionText,
    remainingSteps,
    stepsDone: effectiveStepsDone,
    message: derivedMessage,
    run,
    phase,
  };
}
