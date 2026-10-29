/**
 * @file handleFusion.ts
 * @description Orchestrates fusion swap flow with dependency injection, pre/post refresh, and history integration.
 * @module lib/functions/reactor
 */
import { GluonError, type ChainState, type GluonDeployment } from "@stability-nexus/gluon-ergo-sdk";
import { ACTION_TYPES } from "@/lib/constants/token";
import type { SwapClient, SwapListener, WalletOperations, WalletState, SwapHandlerResult } from "./types";
import { handleTransactionError, handleTransactionSuccess, isWalletCancellation, getGluonErrorMessage } from "@/lib/utils/error-handler";
import { buildExpectedChanges } from "./history";

export interface FusionSwapParams {
  client: SwapClient;
  deployment: GluonDeployment;
  refresh: () => Promise<ChainState>;
  wallet: WalletOperations;
  listener: SwapListener;
  preState: WalletState;
  ergAmount: bigint;
}

export async function handleFusionSwap({
  client,
  deployment,
  refresh,
  wallet,
  listener,
  preState,
  ergAmount,
}: FusionSwapParams): Promise<SwapHandlerResult> {
  if (ergAmount <= 0n) {
    const errorDetails = handleTransactionError(new GluonError("AMOUNT_TOO_SMALL", "Fusion amount must be greater than zero"), "fusion");
    return { error: errorDetails.userMessage };
  }

  // 1. Refresh chain state before building
  let freshChain: ChainState;
  try {
    freshChain = await refresh();
  } catch (err: unknown) {
    const msg = getGluonErrorMessage(err);
    const errorDetails = handleTransactionError(err, "fusion");
    return { error: msg || errorDetails.userMessage };
  }

  // 2. Fetch quote to determine exact inputs for history record
  let quote;
  try {
    quote = client.quoteFusion(freshChain, ergAmount);
  } catch (err: unknown) {
    const errorDetails = handleTransactionError(err, "fusion");
    return { error: errorDetails.userMessage };
  }

  // 3. Fetch user UTXOs and change address
  let userBoxes;
  let changeAddress: string;
  try {
    userBoxes = await wallet.getUtxos();
    changeAddress = await wallet.getChangeAddress();
  } catch (err: unknown) {
    const errorDetails = handleTransactionError(err, "fusion");
    return { error: errorDetails.userMessage };
  }

  // 4. Build unsigned transaction on fresh chain
  let unsignedTx;
  try {
    unsignedTx = client.buildFusion(freshChain, {
      erg: ergAmount,
      userBoxes,
      changeAddress,
    });
  } catch (err: unknown) {
    const errorDetails = handleTransactionError(err, "fusion");
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
    const errorDetails = handleTransactionError(err, "fusion");
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
    const errorDetails = handleTransactionError(err, "fusion");
    return { error: errorDetails.userMessage };
  }

  // 7. Record transaction in transaction listener
  try {
    const expectedChanges = buildExpectedChanges(ACTION_TYPES.FUSION, quote, deployment);
    listener.saveUpTransaction(txHash, ACTION_TYPES.FUSION, preState, expectedChanges);
  } catch (err: unknown) {
    console.error("Failed to record swap in transaction listener:", err);
  }

  // 8. Notify success and refresh chain state
  handleTransactionSuccess(txHash, "fusion");
  await refresh().catch(() => {});

  return { txHash };
}
