/**
 * @file describeQuote.ts
 * @description Pure helper describing pay and receive token flows for a swap quote.
 * @module lib/functions/reactor
 */

import type { ActionQuote, GluonDeployment } from "@stability-nexus/gluon-ergo-sdk";
import { ACTION_TYPES, type ActionType } from "@/lib/constants/token";
import { formatUnits } from "@/lib/utils/amounts";

function isTransmuteToPeg(action: ActionType): action is `transmute-to-${string}` {
  return action === ACTION_TYPES.TRANSMUTE_TO_PEG;
}

function isTransmuteFromPeg(action: ActionType): action is `transmute-from-${string}` {
  return action === ACTION_TYPES.TRANSMUTE_FROM_PEG;
}

export interface QuoteDescriptionItem {
  symbol: string;
  amount: string;
}

export interface QuoteDescription {
  pay: QuoteDescriptionItem[];
  receive: QuoteDescriptionItem[];
}

/**
 * Maps an ActionQuote into user-facing pay and receive item lists using deployment token symbols and decimals.
 * Amounts are formatted losslessly via formatUnits without computing net debits or totals.
 *
 * @param action Swap action type.
 * @param quote Swap quote calculation result.
 * @param deployment Active GluonDeployment specifying token symbols and decimal precisions.
 * @returns {QuoteDescription} Token lists for pay and receive.
 */
export function describeQuote(
  action: ActionType,
  quote: ActionQuote,
  deployment: GluonDeployment
): QuoteDescription {
  const ergDecimals = 9;
  const neutronSymbol = deployment.tokens.neutron.name;
  const neutronDecimals = deployment.tokens.neutron.decimals;
  const protonSymbol = deployment.tokens.proton.name;
  const protonDecimals = deployment.tokens.proton.decimals;

  switch (action) {
    case ACTION_TYPES.FISSION:
      return {
        pay: [{ symbol: "ERG", amount: formatUnits(quote.ergIn, ergDecimals) }],
        receive: [
          { symbol: neutronSymbol, amount: formatUnits(quote.neutronsOut, neutronDecimals) },
          { symbol: protonSymbol, amount: formatUnits(quote.protonsOut, protonDecimals) },
        ],
      };
    case ACTION_TYPES.FUSION:
      return {
        pay: [
          { symbol: neutronSymbol, amount: formatUnits(quote.neutronsIn, neutronDecimals) },
          { symbol: protonSymbol, amount: formatUnits(quote.protonsIn, protonDecimals) },
        ],
        receive: [{ symbol: "ERG", amount: formatUnits(quote.ergOut, ergDecimals) }],
      };
    case ACTION_TYPES.TRANSMUTE_TO_PEG:
      return {
        pay: [{ symbol: protonSymbol, amount: formatUnits(quote.protonsIn, protonDecimals) }],
        receive: [{ symbol: neutronSymbol, amount: formatUnits(quote.neutronsOut, neutronDecimals) }],
      };
    case ACTION_TYPES.TRANSMUTE_FROM_PEG:
      return {
        pay: [{ symbol: neutronSymbol, amount: formatUnits(quote.neutronsIn, neutronDecimals) }],
        receive: [{ symbol: protonSymbol, amount: formatUnits(quote.protonsOut, protonDecimals) }],
      };
    default: {
      if (!isTransmuteToPeg(action) && !isTransmuteFromPeg(action)) {
        const _exhaustiveCheck: never = action;
        throw new Error(`Unsupported action type for describeQuote: ${String(_exhaustiveCheck)}`);
      }
      throw new Error(`Unsupported action type for describeQuote: ${String(action)}`);
    }
  }
}

