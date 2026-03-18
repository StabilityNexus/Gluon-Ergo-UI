import { tokenConfig } from "@/config/tokenConfig";

export const TOKEN_ADDRESS = {
  decimals: 9,
  // Stable asset (Neutron) token address
  stableAsset: "886b7721bef42f60c6317d37d8752da8aca01898cae7dae61808c4a14225edc8",
  // Volatile asset (Proton) token address
  volatileAsset: "9944ff273ff169f32b851b96bbecdbb67f223101c15ae143de82b3e7f75b19d2",
  // Legacy keys for backward compatibility (will be removed)
  gau: "886b7721bef42f60c6317d37d8752da8aca01898cae7dae61808c4a14225edc8",
  gauc: "9944ff273ff169f32b851b96bbecdbb67f223101c15ae143de82b3e7f75b19d2",
};

// Protocol-driven action type keys to support dynamic peg assets
const pegType = tokenConfig.peg.type.toLowerCase().replace(/\s+/g, "-");
export const ACTION_TYPES = {
  FISSION: "fission",
  FUSION: "fusion",
  TRANSMUTE_TO_PEG: `transmute-to-${pegType}`,
  TRANSMUTE_FROM_PEG: `transmute-from-${pegType}`,
} as const;

export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES];
