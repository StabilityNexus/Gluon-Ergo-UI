/**
 * @file history.ts
 * @description Pure functions mapping swap quotes to TransactionListener ExpectedChanges data model.
 * @module lib/functions/reactor
 */

import type { ActionQuote } from "@stability-nexus/gluon-ergo-sdk";
import { ACTION_TYPES, type ActionType } from "@/lib/constants/token";
import type { ExpectedChanges } from "@/lib/utils/transaction-listener";
import { formatUnits } from "@/lib/utils/amounts";

function isTransmuteToPeg(action: ActionType): action is `transmute-to-${string}` {
  return action === ACTION_TYPES.TRANSMUTE_TO_PEG;
}

function isTransmuteFromPeg(action: ActionType): action is `transmute-from-${string}` {
  return action === ACTION_TYPES.TRANSMUTE_FROM_PEG;
}

export function buildExpectedChanges(
  actionType: ActionType,
  quote: ActionQuote,
): ExpectedChanges {
  const toBaseStr = (value: bigint): string => formatUnits(value, 0);
  const fees = toBaseStr(-quote.fees.total);

  switch (actionType) {
    case ACTION_TYPES.FISSION:
      return {
        erg: toBaseStr(-quote.ergIn),
        gau: toBaseStr(quote.neutronsOut),
        gauc: toBaseStr(quote.protonsOut),
        fees,
      };
    case ACTION_TYPES.FUSION:
      return {
        erg: toBaseStr(quote.ergOut),
        gau: toBaseStr(-quote.neutronsIn),
        gauc: toBaseStr(-quote.protonsIn),
        fees,
      };
    case ACTION_TYPES.TRANSMUTE_TO_PEG:
      return {
        erg: "0",
        gau: toBaseStr(quote.neutronsOut),
        gauc: toBaseStr(-quote.protonsIn),
        fees,
      };
    case ACTION_TYPES.TRANSMUTE_FROM_PEG:
      return {
        erg: "0",
        gau: toBaseStr(-quote.neutronsIn),
        gauc: toBaseStr(quote.protonsOut),
        fees,
      };
    default: {
      if (!isTransmuteToPeg(actionType) && !isTransmuteFromPeg(actionType)) {
        const _exhaustiveCheck: never = actionType;
        throw new Error(`Unsupported action type for history: ${String(_exhaustiveCheck)}`);
      }
      throw new Error(`Unsupported action type for history: ${String(actionType)}`);
    }
  }
}
