/**
 * @file swapModel.ts
 * @description Pure reducer and utility functions for swap card state, driving fields, input sanitization, and MAX computation.
 * @module lib/functions/reactor
 */

import type { ChainState, GluonDeployment } from "@stability-nexus/gluon-ergo-sdk";
import { ACTION_TYPES, type ActionType } from "@/lib/constants/token";
import type { SwapClient } from "./types";
import { defaultTokens, getValidToTokens, getActionType } from "./utils";
import {
  calculateFissionMax,
  calculateFusionMax,
  calculateTransmuteToPegMax,
  calculateTransmuteFromPegMax,
} from "./limits";
import { MIN_ERG_RESERVE } from "./constants";
import { formatUnits } from "@/lib/utils/amounts";

/**
 * UI swap card selection and numeric input state.
 */
export interface SwapState {
  fromSymbol: string;
  toSymbol: string;
  amountText: string;
}

/**
 * Minimal balances structure required for MAX computation.
 */
export interface SwapBalances {
  erg: bigint;
  tokens: ReadonlyMap<string, bigint>;
}

export type SwapAction =
  | { type: "selectFrom"; symbol: string; deployment: GluonDeployment }
  | { type: "selectTo"; symbol: string; deployment: GluonDeployment }
  | { type: "reverse"; deployment: GluonDeployment }
  | { type: "setAmount"; amountText: string }
  | { type: "reset"; deployment: GluonDeployment };

/**
 * Creates the initial SwapState (ERG -> Pair token, empty amount).
 *
 * @param deployment Active GluonDeployment configuration.
 * @returns Initial SwapState.
 */
export function createInitialSwapState(deployment: GluonDeployment): SwapState {
  const neutronName = deployment.tokens.neutron.name;
  const protonName = deployment.tokens.proton.name;
  const pairSymbol = `${neutronName}-${protonName}`;

  return {
    fromSymbol: "ERG",
    toSymbol: pairSymbol,
    amountText: "",
  };
}

/**
 * Pure reducer managing token selections, reversals, and input amount resets.
 *
 * Rules:
 * - Selecting from-token resets amountText and recalculates valid to-token.
 * - Selecting an invalid to-token is safely ignored.
 * - Reversals that produce an invalid action type are safely ignored.
 * - Amounts are reset on every token change.
 *
 * @param state Current SwapState.
 * @param action Dispatched SwapAction.
 * @returns Next SwapState.
 */
export function swapReducer(state: SwapState, action: SwapAction): SwapState {
  switch (action.type) {
    case "selectFrom": {
      if (action.symbol === state.fromSymbol) {
        return state;
      }
      const allTokens = defaultTokens(action.deployment);
      const validToTokens = getValidToTokens(action.symbol, allTokens, action.deployment);
      const isCurrentToValid = validToTokens.some((t) => t.symbol === state.toSymbol);
      const toSymbol = isCurrentToValid ? state.toSymbol : (validToTokens[0]?.symbol ?? "");

      return {
        fromSymbol: action.symbol,
        toSymbol,
        amountText: "",
      };
    }
    case "selectTo": {
      if (action.symbol === state.toSymbol) {
        return state;
      }
      const allTokens = defaultTokens(action.deployment);
      const validToTokens = getValidToTokens(state.fromSymbol, allTokens, action.deployment);
      const isValid = validToTokens.some((t) => t.symbol === action.symbol);
      if (!isValid) {
        return state;
      }

      return {
        ...state,
        toSymbol: action.symbol,
        amountText: "",
      };
    }
    case "reverse": {
      const actionType = getActionType(state.toSymbol, state.fromSymbol, action.deployment);
      if (actionType === null) {
        return state;
      }

      return {
        fromSymbol: state.toSymbol,
        toSymbol: state.fromSymbol,
        amountText: "",
      };
    }
    case "setAmount": {
      return {
        ...state,
        amountText: action.amountText,
      };
    }
    case "reset": {
      return createInitialSwapState(action.deployment);
    }
    default:
      return state;
  }
}

/**
 * Determines which field is the driving input for the swap quote.
 * - Fission: from/ERG
 * - Fusion: to/ERG (the ERG amount the user wishes to receive)
 * - Transmutations: from
 *
 * @param action The active swap action type or null.
 * @returns "from" or "to".
 */
export function drivingField(action: ActionType | null): "from" | "to" {
  if (action === ACTION_TYPES.FUSION) {
    return "to";
  }
  return "from";
}

/**
 * Sanitizes raw string input for numeric amount fields.
 * Accepts digits and at most one dot (replaces comma with dot).
 * Enforces maximum fraction digits matching the token's decimals.
 * Returns null for rejected inputs (enabling UI to preserve previous valid text).
 *
 * @param text User-entered raw string.
 * @param decimals Allowed decimal places for the token.
 * @returns Sanitized string or null if rejected.
 */
export function sanitizeAmountInput(text: string, decimals: number): string | null {
  if (text === "") {
    return "";
  }

  // Accept commas as dots
  const normalized = text.replace(/,/g, ".");

  // Reject non-numeric and non-dot characters
  if (!/^\d*\.?\d*$/.test(normalized)) {
    return null;
  }

  const dotCount = normalized.split(".").length - 1;
  if (dotCount > 1) {
    return null;
  }

  if (dotCount === 1) {
    if (decimals === 0) {
      return null;
    }
    const parts = normalized.split(".");
    const fraction = parts[1] ?? "";
    if (fraction.length > decimals) {
      return null;
    }
  }

  return normalized;
}

export interface ComputeMaxParams {
  action: ActionType | null;
  client: SwapClient;
  chain: ChainState;
  balances: SwapBalances;
  deployment: GluonDeployment;
}

/**
 * Computes the maximum executable amount for the given swap action and wallet balances.
 * Applies the MIN_ERG_RESERVE buffer (0.1 ERG) to wallet ERG when calculating fission maximums.
 *
 * @param params Computation parameters including client, chain state, balances, and action.
 * @returns Maximum base units as bigint.
 */
export function computeMax({
  action,
  client,
  chain,
  balances,
  deployment,
}: ComputeMaxParams): bigint {
  if (!action) {
    return 0n;
  }

  const walletErg = balances.erg;
  const neutronId = deployment.tokens.neutron.id;
  const protonId = deployment.tokens.proton.id;
  const walletNeutrons = balances.tokens.get(neutronId) ?? 0n;
  const walletProtons = balances.tokens.get(protonId) ?? 0n;

  switch (action) {
    case ACTION_TYPES.FISSION: {
      const availableErg = walletErg > MIN_ERG_RESERVE ? walletErg - MIN_ERG_RESERVE : 0n;
      return calculateFissionMax(client, chain, availableErg);
    }
    case ACTION_TYPES.FUSION: {
      return calculateFusionMax(client, chain, walletNeutrons, walletProtons, walletErg);
    }
    case ACTION_TYPES.TRANSMUTE_TO_PEG: {
      return calculateTransmuteToPegMax(client, chain, walletProtons);
    }
    case ACTION_TYPES.TRANSMUTE_FROM_PEG: {
      return calculateTransmuteFromPegMax(client, chain, walletNeutrons);
    }
    default:
      return 0n;
  }
}

/**
 * Formats a MAX base-unit bigint into user-facing text using formatUnits.
 *
 * @param max Base-unit bigint.
 * @param decimals Token decimals.
 * @returns Formatted decimal string.
 */
export function formatMaxAmount(max: bigint, decimals: number): string {
  return formatUnits(max, decimals);
}

