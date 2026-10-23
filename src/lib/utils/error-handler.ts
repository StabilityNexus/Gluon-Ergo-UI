/**
 * @file error-handler.ts
 * @description Standardized error handler for transactions, wallet actions, and GluonError codes.
 * @module lib/utils
 */
import { toast } from "sonner";
import { GluonError, type GluonErrorCode } from "@stability-nexus/gluon-ergo-sdk";

export const GLUON_ERROR_MESSAGES: Record<GluonErrorCode, string> = {
  REACTOR_UNHEALTHY: "The reactor is outside its healthy range. Trading resumes after the peg is adjusted.",
  WOULD_LEAVE_HEALTHY_RANGE: "This amount would push the reactor out of its healthy range.",
  REACTOR_HEALTHY: "The reactor is healthy; no peg adjustment is needed.",
  ORACLE_STALE: "The oracle price is too old. Waiting for the next oracle update (usually a few minutes).",
  BOX_AMBIGUOUS: "The reactor or the oracle is being updated right now. Please retry in a minute.",
  BOX_NOT_FOUND: "Could not find the reactor or oracle on the network. Check the node.",
  BUYBACK_UNAVAILABLE: "Transmutations are paused: the oracle's buyback box is unavailable.",
  AMOUNT_TOO_SMALL: "The amount is too small to produce any tokens.",
  AMOUNT_TOO_LARGE: "The reactor cannot pay out or release that amount.",
  INSUFFICIENT_FUNDS: "Not enough ERG or tokens in your wallet for this transaction and its fees.",
  INVALID_ADDRESS: "Your wallet is not connected to Ergo mainnet.",
  NODE_ERROR: "Could not reach the Ergo node. Retrying.",
  UNKNOWN_DEPLOYMENT: "Configuration error: Unknown deployment specified.",
  INVALID_DEPLOYMENT: "Configuration error: Invalid deployment data.",
};

export function getGluonErrorMessage(error: unknown): string | null {
  if (error instanceof GluonError) {
    return GLUON_ERROR_MESSAGES[error.code] || error.message;
  }
  return null;
}

export enum ErrorType {
  NETWORK = "NETWORK",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  TRANSACTION_CREATION = "TRANSACTION_CREATION",
  WALLET_CONNECTION = "WALLET_CONNECTION",
  WALLET_SIGNING = "WALLET_SIGNING",
  TRANSACTION_SUBMISSION = "TRANSACTION_SUBMISSION",
  UTXO_VALIDATION = "UTXO_VALIDATION",
  BOX_INITIALIZATION = "BOX_INITIALIZATION",
  ORACLE_ERROR = "ORACLE_ERROR",
  INVALID_AMOUNT = "INVALID_AMOUNT",
  SDK_ERROR = "SDK_ERROR",
  CALCULATION_ERROR = "CALCULATION_ERROR",
  UNKNOWN = "UNKNOWN",
}

export interface ErrorDetails {
  type: ErrorType;
  message: string;
  technicalMessage?: string;
  userMessage: string;
  actionType?: string;
}

const ERROR_PATTERNS = {
  network: [/network/i, /connection/i, /timeout/i, /fetch.*failed/i, /failed to get network height/i, /node.*not.*responding/i, /rpc.*error/i],
  insufficientBalance: [/insufficient/i, /not enough/i, /balance.*too.*low/i, /cannot.*afford/i, /exceeds.*balance/i, /maximum possible output/i, /cannot get.*erg/i],
  transactionCreation: [
    /failed to create.*transaction/i,
    /transaction.*creation.*failed/i,
    /invalid.*transaction/i,
    /cannot.*build.*transaction/i,
    /unsigned.*transaction.*failed/i,
  ],
  walletConnection: [/wallet.*not.*connected/i, /no.*wallet/i, /wallet.*unavailable/i, /ergo.*wallet.*not.*found/i],
  walletSigning: [
    /sign.*failed/i,
    /signing.*error/i,
    /user.*rejected/i,
    /signature.*failed/i,
    /wallet.*sign/i,
    /cancelled.*by.*user/i,
    /transaction.*cancelled/i,
    /user.*cancelled/i,
    /denied.*by.*user/i,
  ],
  transactionSubmission: [/submit.*failed/i, /submission.*error/i, /broadcast.*failed/i, /mempool.*rejected/i, /transaction.*rejected/i],
  utxoValidation: [/malformed transaction.*every input.*should be in utxo/i, /missing inputs/i, /input.*not.*in.*utxo/i],
  boxInitialization: [/failed to.*get.*box/i, /box.*not.*found/i, /oracle.*box.*error/i, /gluon.*box.*error/i, /failed to initialize/i],
  oracle: [/oracle/i, /price.*feed/i, /oracle.*buyback/i, /height.*error/i],
  invalidAmount: [/amount.*invalid/i, /invalid.*value/i, /must be greater than zero/i, /amount.*too.*small/i, /amount.*too.*large/i],
  sdk: [/gluon.*sdk/i, /calculation.*failed/i],
};

const USER_MESSAGES: Record<ErrorType, string> = {
  [ErrorType.NETWORK]: "Network connection error. Please check your internet connection and try again.",
  [ErrorType.INSUFFICIENT_BALANCE]: "Insufficient balance for this transaction.",
  [ErrorType.TRANSACTION_CREATION]: "Failed to create transaction. Please try again.",
  [ErrorType.WALLET_CONNECTION]: "Wallet not connected. Please connect your wallet first.",
  [ErrorType.WALLET_SIGNING]: "Transaction was cancelled by user or signing failed. Please try again.",
  [ErrorType.TRANSACTION_SUBMISSION]: "Failed to submit transaction to the network. Please try again.",
  [ErrorType.UTXO_VALIDATION]: "Transaction failed due to stale blockchain data. Please try again.",
  [ErrorType.BOX_INITIALIZATION]: "Failed to initialize blockchain data. Please refresh and try again.",
  [ErrorType.ORACLE_ERROR]: "Oracle data unavailable. Please try again in a moment.",
  [ErrorType.INVALID_AMOUNT]: "Invalid amount entered. Please check your input.",
  [ErrorType.SDK_ERROR]: "Calculation error. Please try again with different values.",
  [ErrorType.CALCULATION_ERROR]: "Failed to calculate transaction amounts. Please try again.",
  [ErrorType.UNKNOWN]: "An unexpected error occurred. Please try again.",
};

function classifyWalletErrorCode(code: number): ErrorType {
  switch (code) {
    case 2:
      return ErrorType.WALLET_SIGNING;
    case 1:
      return ErrorType.WALLET_CONNECTION;
    case 3:
      return ErrorType.INSUFFICIENT_BALANCE;
    case 4:
      return ErrorType.TRANSACTION_CREATION;
    case 5:
      return ErrorType.NETWORK;
    default:
      return ErrorType.UNKNOWN;
  }
}

function classifyError(error: unknown): ErrorType {
  if (error instanceof GluonError) {
    return ErrorType.SDK_ERROR;
  }

  if (error && typeof error === "object" && !Array.isArray(error) && !(error instanceof Error)) {
    const errObj = error as { code?: number };
    if (typeof errObj.code === "number") {
      return classifyWalletErrorCode(errObj.code);
    }
  }

  const errorMessage =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : (error as { info?: string; message?: string })?.info || (error as { message?: string })?.message || String(error);

  for (const [type, patterns] of Object.entries(ERROR_PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(errorMessage))) {
      switch (type) {
        case "network":
          return ErrorType.NETWORK;
        case "insufficientBalance":
          return ErrorType.INSUFFICIENT_BALANCE;
        case "transactionCreation":
          return ErrorType.TRANSACTION_CREATION;
        case "walletConnection":
          return ErrorType.WALLET_CONNECTION;
        case "walletSigning":
          return ErrorType.WALLET_SIGNING;
        case "transactionSubmission":
          return ErrorType.TRANSACTION_SUBMISSION;
        case "utxoValidation":
          return ErrorType.UTXO_VALIDATION;
        case "boxInitialization":
          return ErrorType.BOX_INITIALIZATION;
        case "oracle":
          return ErrorType.ORACLE_ERROR;
        case "invalidAmount":
          return ErrorType.INVALID_AMOUNT;
        case "sdk":
          return ErrorType.SDK_ERROR;
        default:
          return ErrorType.UNKNOWN;
      }
    }
  }

  return ErrorType.UNKNOWN;
}

export function handleTransactionError(error: unknown, actionType: string = "transaction", showToast: boolean = true): ErrorDetails {
  console.error(`${actionType} error:`, error);

  const gluonMessage = getGluonErrorMessage(error);

  let errorMessage: string;
  let technicalMessage: string;

  if (error && typeof error === "object" && !Array.isArray(error) && !(error instanceof Error)) {
    const walletError = error as { info?: string; message?: string; code?: number };
    if (walletError.info) {
      errorMessage = walletError.info;
      technicalMessage = `Wallet error - Code: ${walletError.code}, Info: ${walletError.info}`;
    } else if (walletError.message) {
      errorMessage = walletError.message;
      technicalMessage = `Error object: ${JSON.stringify(walletError)}`;
    } else {
      errorMessage = "Wallet error occurred";
      technicalMessage = `Unknown wallet error: ${JSON.stringify(walletError)}`;
    }
  } else if (error instanceof Error) {
    errorMessage = error.message;
    technicalMessage = error.stack || error.message;
  } else if (typeof error === "string") {
    errorMessage = error;
    technicalMessage = error;
  } else {
    errorMessage = "An unknown error occurred";
    technicalMessage = String(error);
  }

  const errorType = classifyError(error);
  const userMessage = gluonMessage || USER_MESSAGES[errorType];

  const errorDetails: ErrorDetails = {
    type: errorType,
    message: errorMessage,
    technicalMessage,
    userMessage,
    actionType,
  };

  if (showToast) {
    toast.error(userMessage, {
      description: errorType === ErrorType.UNKNOWN ? errorMessage : undefined,
      duration: 5000,
    });
  }

  return errorDetails;
}

export function handleTransactionSuccess(txHash: string, actionType: string, showToast: boolean = true): void {
  const capitalizedAction = actionType.charAt(0).toUpperCase() + actionType.slice(1);
  const successMessage = `${capitalizedAction} transaction submitted successfully!`;

  const explorerService = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer.ergoplatform.com";
  const explorerUrl = `${explorerService}/en/transactions/${txHash}`;

  console.log(`${actionType} success:`, { txHash });

  if (showToast) {
    toast.success(successMessage, {
      description: `Transaction ID: ${txHash.slice(0, 8)}...${txHash.slice(-8)}`,
      duration: 10000,
      action: {
        label: "View on Explorer",
        onClick: () => {
          window.open(explorerUrl, "_blank", "noopener,noreferrer");
        },
      },
    });
  }
}
