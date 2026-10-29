/**
 * @file handleTransmutation.ts
 * @description Orchestrates transmutation (beta decay) flows with dependency injection, pre/post refresh, and history integration.
 * @module lib/functions/reactor
 */
import { GluonError, type ChainState, type GluonDeployment } from "@stability-nexus/gluon-ergo-sdk";
import { ACTION_TYPES } from "@/lib/constants/token";
import type { SwapClient, SwapListener, WalletOperations, WalletState, SwapHandlerResult } from "./types";
import { handleTransactionError, handleTransactionSuccess, isWalletCancellation, getGluonErrorMessage } from "@/lib/utils/error-handler";
import { buildExpectedChanges } from "./history";

export interface TransmuteSwapParams {
  client: SwapClient;
  deployment: GluonDeployment;
  refresh: () => Promise<ChainState>;
  wallet: WalletOperations;
  listener: SwapListener;
  preState: WalletState;
  amount: bigint;
  direction: "to-peg" | "from-peg";
}

export async function handleTransmutationSwap({
  client,
  deployment,
  refresh,
  wallet,
  listener,
  preState,
  amount,
  direction,
}: TransmuteSwapParams): Promise<SwapHandlerResult> {
  const actionName = direction === "to-peg" ? "transmute to peg" : "transmute from peg";
  const actionType = direction === "to-peg" ? ACTION_TYPES.TRANSMUTE_TO_PEG : ACTION_TYPES.TRANSMUTE_FROM_PEG;

  if (amount <= 0n) {
    const errorDetails = handleTransactionError(new GluonError("AMOUNT_TOO_SMALL", "Transmutation amount must be greater than zero"), actionName);
    return { error: errorDetails.userMessage };
  }

  // 1. Refresh chain state before building
  let freshChain: ChainState;
  try {
    freshChain = await refresh();
  } catch (err: unknown) {
    const msg = getGluonErrorMessage(err);
    const errorDetails = handleTransactionError(err, actionName);
    return { error: msg || errorDetails.userMessage };
  }

  // 2. Fetch quote to determine exact outputs for history record
  let quote;
  try {
    quote = direction === "to-peg"
      ? client.quoteBetaDecayPlus(freshChain, amount)
      : client.quoteBetaDecayMinus(freshChain, amount);
  } catch (err: unknown) {
    const errorDetails = handleTransactionError(err, actionName);
    return { error: errorDetails.userMessage };
  }

  // 3. Fetch user UTXOs and change address
  let userBoxes;
  let changeAddress: string;
  try {
    userBoxes = await wallet.getUtxos();
    changeAddress = await wallet.getChangeAddress();
  } catch (err: unknown) {
    const errorDetails = handleTransactionError(err, actionName);
    return { error: errorDetails.userMessage };
  }

  // 4. Build unsigned transaction on fresh chain
  let unsignedTx;
  try {
    unsignedTx = direction === "to-peg"
      ? client.buildBetaDecayPlus(freshChain, {
          protons: amount,
          userBoxes,
          changeAddress,
        })
      : client.buildBetaDecayMinus(freshChain, {
          neutrons: amount,
          userBoxes,
          changeAddress,
        });
  } catch (err: unknown) {
    const errorDetails = handleTransactionError(err, actionName);
    return { error: errorDetails.userMessage };
  }

  // 5. Sign (only signTx rejection counts as user cancellation)
  let signedTx;
  try {
    signedTx = await wallet.signTx(unsignedTx);
  } catch (err: unknown) {
    if (isWalletCancellation(err)) {
      return { cancelled: true };
    }
    const errorDetails = handleTransactionError(err, actionName);
    return { error: errorDetails.userMessage };
  }

  // 6. Submit (submit failures are never treated as user cancellation)
  let txHash: string;
  try {
    txHash = await wallet.submitTx(signedTx);
    if (!txHash) {
      throw new Error("Transaction submission failed: no transaction hash returned");
    }
  } catch (err: unknown) {
    const errorDetails = handleTransactionError(err, actionName);
    return { error: errorDetails.userMessage };
  }

  // 7. Record transaction in transaction listener
  try {
    const expectedChanges = buildExpectedChanges(actionType, quote);
    listener.saveUpTransaction(txHash, actionType, preState, expectedChanges);
  } catch (err: unknown) {
    console.error("Failed to record swap in transaction listener:", err);
  }

  // 8. Notify success and refresh chain state
  handleTransactionSuccess(txHash, actionName);
  await refresh().catch(() => {});

  return { txHash };
}
