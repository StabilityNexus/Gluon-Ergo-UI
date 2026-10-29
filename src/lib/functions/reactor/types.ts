/**
 * @file types.ts
 * @description Domain types for swap, reactor tokens, and typed wallet/listener contracts.
 * @module lib/functions/reactor
 */
import type { GluonClient } from "@stability-nexus/gluon-ergo-sdk";
import type { ActionType } from "@/lib/constants/token";
import type { Amount, Box, EIP12UnsignedTransaction, SignedTransaction } from "@fleet-sdk/common";
import type { TransactionListener, WalletState } from "@/lib/utils/transaction-listener";

export type SwapAction = ActionType;

export type SwapClient = Pick<
  GluonClient,
  | "quoteFission"
  | "quoteFusion"
  | "quoteBetaDecayPlus"
  | "quoteBetaDecayMinus"
  | "maxBetaDecayPlus"
  | "maxBetaDecayMinus"
  | "buildFission"
  | "buildFusion"
  | "buildBetaDecayPlus"
  | "buildBetaDecayMinus"
>;

export interface Token {
  symbol: string;
  name: string;
  color: string;
  balance: string;
  tokenId: string;
  decimals: number;
}

export type SwapListener = Pick<TransactionListener, "saveUpTransaction">;
export type { WalletState };

export interface WalletOperations {
  getUtxos: () => Promise<Box<Amount>[]>;
  getChangeAddress: () => Promise<string>;
  signTx: (unsigned: EIP12UnsignedTransaction) => Promise<SignedTransaction>;
  submitTx: (signed: SignedTransaction) => Promise<string>;
}

export interface SwapHandlerResult {
  txHash?: string;
  cancelled?: boolean;
  error?: string;
}
