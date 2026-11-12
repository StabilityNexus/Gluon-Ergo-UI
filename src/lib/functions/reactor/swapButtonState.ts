/**
 * @file swapButtonState.ts
 * @description Pure function computing swap action button state, labels, and inline errors with strict precedence.
 * @module lib/functions/reactor
 */

import { ACTION_TYPES, type ActionType } from "@/lib/constants/token";
import type { QuoteResult } from "./quotes";
import type { SwapAvailability } from "./availability";
import { getGluonErrorMessage } from "@/lib/utils/error-handler";

export interface SwapButtonStateInput {
  connected: boolean;
  walletReady: boolean;
  balancesReady: boolean;
  listenerReady: boolean;
  availability: SwapAvailability;
  action: ActionType | null;
  amountText: string;
  quote: {
    status: "idle" | "pending" | "ready";
    result?: QuoteResult;
  };
  limits: {
    exceeds: "none" | "balance" | "max";
  };
  max?: bigint;
  maxText?: string;
  decimals?: number;
  inProgress: boolean;
  hasPending: boolean;
}

export interface SwapButtonState {
  disabled: boolean;
  label: string;
  inlineError?: string;
}

function isActionAvailable(availability: SwapAvailability, action: ActionType | null): boolean {
  if (action === null) {
    return false;
  }
  switch (action) {
    case ACTION_TYPES.FISSION:
      return availability.fission;
    case ACTION_TYPES.FUSION:
      return availability.fusion;
    case ACTION_TYPES.TRANSMUTE_TO_PEG:
      return availability.transmuteToPeg;
    case ACTION_TYPES.TRANSMUTE_FROM_PEG:
      return availability.transmuteFromPeg;
    default:
      return false;
  }
}

/**
 * Computes button label, disabled state, and inline validation errors based on 12-level precedence order:
 *
 * 1. !connected || !walletReady -> "Connect wallet (top bar)" (disabled)
 * 2. availability flag for action is false -> banner code LOADING => "Loading reactor data…", else "Trading paused" (disabled)
 * 3. !balancesReady || !listenerReady -> "Loading wallet…" (disabled)
 * 4. inProgress -> "Transaction in progress…" (disabled)
 * 5. hasPending -> "Transaction pending…" (disabled)
 * 6. empty amount -> "Enter an amount" (disabled)
 * 7. quote.status "pending" -> "Calculating…" (disabled)
 * 8. quote invalid-input -> "Enter a valid amount" (disabled, inlineError = message)
 * 9. quote gluon error -> WOULD_LEAVE_HEALTHY_RANGE => "Exceeds healthy limit", AMOUNT_TOO_SMALL => "Amount too small", other => "Cannot swap"; inlineError = getGluonErrorMessage(error, { max, decimals })
 * 10. quote unexpected -> "Cannot swap", inlineError "Unexpected error while calculating the quote"
 * 11. limits.exceeds "balance" -> "Insufficient balance"; "max" -> "Exceeds maximum" (disabled)
 * 12. otherwise -> "Swap" (enabled)
 *
 * @param input Consolidated reactor, wallet, quote, and limits state.
 * @returns {SwapButtonState} Disabled flag, action label, and optional inline error string.
 */
export function getSwapButtonState(input: SwapButtonStateInput): SwapButtonState {
  // 1. Not connected or wallet not ready (restoring / not initialized)
  if (!input.connected || !input.walletReady) {
    return {
      disabled: true,
      label: "Connect wallet (top bar)",
    };
  }

  // 2. Action blocked by availability
  if (!isActionAvailable(input.availability, input.action)) {
    const isBannerLoading = input.availability.banner?.code === "LOADING";
    return {
      disabled: true,
      label: isBannerLoading ? "Loading reactor data…" : "Trading paused",
    };
  }

  // 3. Wallet data (balances or transaction listener) not ready
  if (!input.balancesReady || !input.listenerReady) {
    return {
      disabled: true,
      label: "Loading wallet…",
    };
  }

  // 4. Transaction in progress
  if (input.inProgress) {
    return {
      disabled: true,
      label: "Transaction in progress…",
    };
  }

  // 5. Transaction pending confirmation
  if (input.hasPending) {
    return {
      disabled: true,
      label: "Transaction pending…",
    };
  }

  // 6. Empty amount
  if (input.amountText.trim() === "") {
    return {
      disabled: true,
      label: "Enter an amount",
    };
  }

  // 7. Quote pending calculation
  if (input.quote.status === "pending") {
    return {
      disabled: true,
      label: "Calculating…",
    };
  }

  // 8. Quote invalid input
  if (input.quote.result && !input.quote.result.ok && input.quote.result.kind === "invalid-input") {
    return {
      disabled: true,
      label: "Enter a valid amount",
      inlineError: input.quote.result.message,
    };
  }

  // 9. Quote GluonError
  if (input.quote.result && !input.quote.result.ok && input.quote.result.kind === "gluon") {
    const err = input.quote.result.error;
    let label = "Cannot swap";
    if (err.code === "WOULD_LEAVE_HEALTHY_RANGE") {
      label = "Exceeds healthy limit";
    } else if (err.code === "AMOUNT_TOO_SMALL") {
      label = "Amount too small";
    }

    let inlineError =
      getGluonErrorMessage(err, {
        max: input.max,
        decimals: input.decimals,
      }) || err.message;

    if (err.code === "WOULD_LEAVE_HEALTHY_RANGE" && input.maxText && input.max === undefined) {
      inlineError = `This amount would push the reactor out of its healthy range. The maximum is ${input.maxText}.`;
    }

    return {
      disabled: true,
      label,
      inlineError,
    };
  }

  // 10. Quote unexpected error
  if (input.quote.result && !input.quote.result.ok && input.quote.result.kind === "unexpected") {
    return {
      disabled: true,
      label: "Cannot swap",
      inlineError: "Unexpected error while calculating the quote",
    };
  }

  // 11. Limits exceeded
  if (input.limits.exceeds === "balance") {
    return {
      disabled: true,
      label: "Insufficient balance",
    };
  }
  if (input.limits.exceeds === "max") {
    return {
      disabled: true,
      label: "Exceeds maximum",
    };
  }

  // 12. Valid and ready
  return {
    disabled: false,
    label: "Swap",
  };
}
