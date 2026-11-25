/**
 * @file handleAdjustPeg.ts
 * @description Orchestrates the Adjust Peg transaction step, error mapping, and post-submission box polling.
 * @module lib/functions/reactor
 */

import { GluonError, type ChainState, type GluonClient } from "@stability-nexus/gluon-ergo-sdk";
import type { WalletOperations } from "./types";
import {
  handleTransactionError,
  handleTransactionSuccess,
  isWalletCancellation,
  getGluonErrorMessage,
} from "@/lib/utils/error-handler";

// NOTE: Adjust Peg is an open protocol-level maintenance action rather than a user swap.
// It moves no user swap tokens, charges no protocol fee, and requires no transaction-listener
// record or balance differential history save.

export type AdjustPegClient = Pick<GluonClient, "buildAdjustPeg">;

export type AdjustPegResult =
  | { ok: true; txHash: string; seen: boolean; chain?: ChainState }
  | { ok: false; kind: "cancelled" }
  | { ok: false; kind: "healthy"; message: string }
  | { ok: false; kind: "retry-later"; code: string; message: string }
  | { ok: false; kind: "error"; message: string };

export interface WaitForReactorBoxParams {
  refresh: () => Promise<ChainState>;
  txId: string;
  pollMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface HandleAdjustPegStepParams {
  client: AdjustPegClient;
  refresh: () => Promise<ChainState>;
  wallet: WalletOperations;
  pollMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onSubmitted?: (txHash: string) => void;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Maps errors from building, refreshing, signing, or submitting an Adjust Peg step.
 * Healthy, retry-later, and cancelled cases never toast. Only kind "error" produces a toast.
 */
function mapAdjustPegError(err: unknown): AdjustPegResult {
  if (err instanceof GluonError) {
    if (err.code === "REACTOR_HEALTHY") {
      return {
        ok: false,
        kind: "healthy",
        message: "The reactor is healthy again; no peg adjustment is needed.",
      };
    }
    if (
      err.code === "ORACLE_STALE" ||
      err.code === "BOX_AMBIGUOUS" ||
      err.code === "NODE_ERROR" ||
      err.code === "BOX_NOT_FOUND"
    ) {
      const message = getGluonErrorMessage(err) || err.message;
      return {
        ok: false,
        kind: "retry-later",
        code: err.code,
        message,
      };
    }
  }

  // Any other error (INSUFFICIENT_FUNDS, INVALID_ADDRESS, network/node exception, UTXO fetch error)
  const details = handleTransactionError(err, "adjust peg", true);
  return {
    ok: false,
    kind: "error",
    message: details.userMessage || details.message,
  };
}

/**
 * Polls refresh() until the reactor box created by txId appears in chain state or timeout is reached.
 * Refreshes run up to Math.max(1, Math.ceil(timeoutMs / pollMs)) attempts.
 * Transient errors during polling are ignored. No sleep is performed after the final attempt.
 *
 * @param params - Configuration containing refresh function, txId, polling interval, timeout, and sleep adapter.
 * @returns Object indicating whether the box was seen and the latest ChainState if seen.
 */
export async function waitForReactorBox({
  refresh,
  txId,
  pollMs = 2000,
  timeoutMs = 60000,
  sleep = defaultSleep,
}: WaitForReactorBoxParams): Promise<{ seen: boolean; chain?: ChainState }> {
  const attempts = Math.max(1, Math.ceil(timeoutMs / pollMs));
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const chain = await refresh();
      if (chain?.reactor?.transactionId === txId) {
        return { seen: true, chain };
      }
    } catch {
      // Transient refresh errors (such as BOX_AMBIGUOUS or node timeouts) during polling are ignored
    }
    if (attempt < attempts - 1) {
      await sleep(pollMs);
    }
  }
  return { seen: false };
}

/**
 * Executes a single Adjust Peg step:
 * 1. Refreshes chain state
 * 2. Fetches wallet UTXOs and change address
 * 3. Builds unsigned transaction via client.buildAdjustPeg
 * 4. Requests wallet signature (cancellation stops silently with no toast)
 * 5. Submits signed transaction to the network
 * 6. Signals onSubmitted callback and displays success toast
 * 7. Polls for the new reactor box created by the submitted transaction
 *
 * @param params - Step execution parameters and dependency injection.
 * @returns AdjustPegResult indicating success (and whether box was seen) or specific error kind.
 */
export async function handleAdjustPegStep({
  client,
  refresh,
  wallet,
  pollMs = 2000,
  timeoutMs = 60000,
  sleep = defaultSleep,
  onSubmitted,
}: HandleAdjustPegStepParams): Promise<AdjustPegResult> {
  // 1. Refresh chain state before building
  let freshChain: ChainState;
  try {
    freshChain = await refresh();
  } catch (err: unknown) {
    return mapAdjustPegError(err);
  }

  // 2. Fetch wallet UTXOs and change address
  let userBoxes;
  let changeAddress: string;
  try {
    userBoxes = await wallet.getUtxos();
    changeAddress = await wallet.getChangeAddress();
  } catch (err: unknown) {
    return mapAdjustPegError(err);
  }

  // 3. Build unsigned transaction
  let unsignedTx;
  try {
    unsignedTx = client.buildAdjustPeg(freshChain, {
      userBoxes,
      changeAddress,
    });
  } catch (err: unknown) {
    return mapAdjustPegError(err);
  }

  // 4. Sign transaction (only sign rejection is treated as user cancellation)
  let signedTx;
  try {
    signedTx = await wallet.signTx(unsignedTx);
  } catch (err: unknown) {
    if (isWalletCancellation(err)) {
      return { ok: false, kind: "cancelled" };
    }
    return mapAdjustPegError(err);
  }

  // 5. Submit transaction (submission failures are never user cancellation)
  let txHash: string;
  try {
    txHash = await wallet.submitTx(signedTx);
    if (!txHash) {
      throw new Error("Transaction submission failed: no transaction hash returned");
    }
  } catch (err: unknown) {
    return mapAdjustPegError(err);
  }

  // 6. Callback and success notification
  onSubmitted?.(txHash);
  handleTransactionSuccess(txHash, "adjust peg");

  // 7. Await reactor box emergence
  const waitResult = await waitForReactorBox({
    refresh,
    txId: txHash,
    pollMs,
    timeoutMs,
    sleep,
  });

  if (waitResult.seen) {
    return {
      ok: true,
      txHash,
      seen: true,
      chain: waitResult.chain,
    };
  }

  return {
    ok: true,
    txHash,
    seen: false,
  };
}
