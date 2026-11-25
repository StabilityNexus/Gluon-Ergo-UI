/**
 * @file adjustPegState.ts
 * @description Pure state function computing Adjust Peg button state, label, and action with strict precedence.
 * @module lib/functions/reactor
 */

import type { ProtocolSnapshot } from "@stability-nexus/gluon-ergo-sdk";

export type AdjustPegPhase = "idle" | "signing" | "waiting" | "timeout";

export type AdjustPegAction = "adjust" | "recheck" | "none";

export interface AdjustPegStateInput {
  snapshot?: ProtocolSnapshot;
  status: "loading" | "ready" | "error";
  error?: unknown;
  connected: boolean;
  walletReady: boolean;
  networkBlocked?: boolean;
  phase: AdjustPegPhase;
  stepsDone: number;
  remainingSteps?: number;
}

export interface AdjustPegState {
  visible: boolean;
  disabled: boolean;
  label: string;
  action: AdjustPegAction;
}

/**
 * Computes visibility, button disabled status, label text, and action type for Adjust Peg.
 *
 * Precedence Order (when visible):
 * 1.  !connected || !walletReady: "Connect wallet (top bar)" (disabled, "none")
 * 1b. networkBlocked: "Wrong network" (disabled, "none")
 * 2.  phase === "signing": "Waiting for your wallet…" (disabled, "none")
 * 3.  phase === "waiting": "Waiting for the network…" (disabled, "none")
 * 4.  phase === "timeout": "Check again" (enabled, "recheck")
 * 5.  error || status === "error": "Waiting for the network…" (disabled, "none")
 * 6.  snapshot.oracleAge >= 35: "Waiting for the next oracle update…" (disabled, "none")
 * 7.  !remainingSteps || remainingSteps === 0: "Checking…" (disabled, "none")
 * 8.  Otherwise: "Adjust peg (step ${stepsDone + 1} of ${stepsDone + remainingSteps})" (enabled, "adjust")
 *
 * @param input - Current snapshot, wallet connection, network, and execution phase.
 * @returns Evaluated AdjustPegState object.
 */
export function getAdjustPegState(input: AdjustPegStateInput): AdjustPegState {
  const visible = input.snapshot !== undefined && input.snapshot.healthy === false;

  if (!visible) {
    return {
      visible: false,
      disabled: true,
      label: "",
      action: "none",
    };
  }

  // 1. Wallet connection
  if (!input.connected || !input.walletReady) {
    return {
      visible: true,
      disabled: true,
      label: "Connect wallet (top bar)",
      action: "none",
    };
  }

  // 1b. Network guard
  if (input.networkBlocked) {
    return {
      visible: true,
      disabled: true,
      label: "Wrong network",
      action: "none",
    };
  }

  // 2. Signing phase
  if (input.phase === "signing") {
    return {
      visible: true,
      disabled: true,
      label: "Waiting for your wallet…",
      action: "none",
    };
  }

  // 3. Waiting phase (in-flight transaction waiting for mempool / box appearance)
  if (input.phase === "waiting") {
    return {
      visible: true,
      disabled: true,
      label: "Waiting for the network…",
      action: "none",
    };
  }

  // 4. Timeout phase (polling elapsed without seeing transaction)
  if (input.phase === "timeout") {
    return {
      visible: true,
      disabled: false,
      label: "Check again",
      action: "recheck",
    };
  }

  // 5. Transient error / provider error
  if (Boolean(input.error) || input.status === "error") {
    return {
      visible: true,
      disabled: true,
      label: "Waiting for the network…",
      action: "none",
    };
  }

  // 6. Stale oracle
  if (input.snapshot !== undefined && input.snapshot.oracleAge >= 35) {
    return {
      visible: true,
      disabled: true,
      label: "Waiting for the next oracle update…",
      action: "none",
    };
  }

  // 7. Remaining steps not yet known or 0
  if (input.remainingSteps === undefined || input.remainingSteps === 0) {
    return {
      visible: true,
      disabled: true,
      label: "Checking…",
      action: "none",
    };
  }

  // 8. Normal execution
  const currentStep = input.stepsDone + 1;
  const totalSteps = input.stepsDone + input.remainingSteps;
  return {
    visible: true,
    disabled: false,
    label: `Adjust peg (step ${currentStep} of ${totalSteps})`,
    action: "adjust",
  };
}
