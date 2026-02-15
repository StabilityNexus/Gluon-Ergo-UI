import BigNumber from "bignumber.js";

// Token symbols - using generic names (Neutron/Proton)
// These map to the config values but are kept as string literals for type safety
export type TokenSymbol = "ERG" | "NEUTRON" | "PROTON" | "NEUTRON-PROTON";
// Legacy type aliases for backward compatibility during migration
export type LegacyTokenSymbol = "ERG" | "GAU" | "GAUC" | "GAU-GAUC";
export type SwapAction = "erg-to-pair" | "pair-to-erg" | "volatile-to-stable" | "stable-to-volatile";
// Legacy swap action types for backward compatibility
export type LegacySwapAction = "erg-to-gau-gauc" | "gau-gauc-to-erg" | "gauc-to-gau" | "gau-to-gauc";

export interface Token {
  symbol: TokenSymbol;
  name: string;
  color: string;
  balance: string;
  tokenId: string;
  decimals: number;
}

export interface TokenPair {
  from: TokenSymbol;
  to: TokenSymbol;
}

export interface ReceiptDetails {
  inputAmount: number | BigNumber;
  outputAmount: {
    stableAsset: number | BigNumber;
    volatileAsset: number | BigNumber;
    erg: number | BigNumber;
    // Legacy fields for backward compatibility
    gau: number | BigNumber;
    gauc: number | BigNumber;
  };
  fees: {
    devFee: number | BigNumber;
    uiFee: number | BigNumber;
    oracleFee: number | BigNumber;
    minerFee: number | BigNumber;
    totalFee: number | BigNumber;
  };
  maxErgOutput?: string;
}

export interface BoxData {
  assets?: any[];
  additionalRegisters?: Record<string, any>;
  value?: number;
}

export interface GluonBoxes {
  gluonBox: any;
  oracleBox: any;
}

export interface SwapResult {
  stableAssetAmount: string;
  volatileAssetAmount: string;
  toAmount: string;
  maxErgOutput: string;
  receiptDetails: ReceiptDetails;
  // Legacy fields for backward compatibility
  gauAmount: string;
  gaucAmount: string;
}

export interface SwapError {
  error: string;
  resetValues?: {
    stableAssetAmount?: string;
    volatileAssetAmount?: string;
    toAmount?: string;
    // Legacy fields for backward compatibility
    gauAmount?: string;
    gaucAmount?: string;
  };
}
