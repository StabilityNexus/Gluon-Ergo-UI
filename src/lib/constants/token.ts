/**
 * @file token.ts
 * @description Action types and token constants.
 * @module lib/constants
 */
import { tokenConfig } from "@/config/tokenConfig";

// Protocol-driven action type keys to support dynamic peg assets
const pegType = tokenConfig.peg.type.toLowerCase().replace(/\s+/g, "-");

export const ACTION_TYPES = {
  FISSION: "fission",
  FUSION: "fusion",
  TRANSMUTE_TO_PEG: `transmute-to-${pegType}`,
  TRANSMUTE_FROM_PEG: `transmute-from-${pegType}`,
} as const;

export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES];
