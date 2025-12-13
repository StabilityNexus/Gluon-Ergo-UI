/**
 * Centralized token configuration
 * This file defines all token names, symbols, and peg-related text
 * to make the frontend generic and configurable.
 */

export interface TokenConfig {
  // Base asset (e.g., ERG)
  baseAsset: {
    name: string;
    symbol: string;
  };
  
  // Stable asset (formerly GAU/Neutron)
  stableAsset: {
    name: string;
    symbol: string;
    displayName: string; // Full display name
    description: string; // Description text
  };
  
  // Volatile asset (formerly GAUC/Proton)
  volatileAsset: {
    name: string;
    symbol: string;
    displayName: string; // Full display name
    description: string; // Description text
  };
  
  // Peg configuration
  peg: {
    type: string; // e.g., "Gold", "USD"
    unit: string; // e.g., "1g", "1 USD"
    description: string; // Description of the peg
  };
  
  // Pair token (combined stable + volatile)
  pairToken: {
    name: string;
    symbol: string;
  };
}

// Default configuration (can be changed to support different pegs)
export const tokenConfig: TokenConfig = {
  baseAsset: {
    name: "Ergo",
    symbol: "ERG",
  },
  stableAsset: {
    name: "Neutron",
    symbol: "NEUTRON",
    displayName: "Neutron",
    description: "The stablecoin pegged to the base asset.",
  },
  volatileAsset: {
    name: "Proton",
    symbol: "PROTON",
    displayName: "Proton",
    description: "Tokenizes the reserve surplus and provides leveraged volatility and yield.",
  },
  peg: {
    type: "Asset",
    unit: "1 unit",
    description: "Pegged to the base asset value.",
  },
  pairToken: {
    name: "Neutron-Proton Pair",
    symbol: "NEUTRON-PROTON",
  },
};

// Helper functions to get token symbols (for backward compatibility during migration)
export const getStableAssetSymbol = (): string => tokenConfig.stableAsset.symbol;
export const getVolatileAssetSymbol = (): string => tokenConfig.volatileAsset.symbol;
export const getPairTokenSymbol = (): string => tokenConfig.pairToken.symbol;
export const getBaseAssetSymbol = (): string => tokenConfig.baseAsset.symbol;

// Helper to get peg description
export const getPegDescription = (): string => tokenConfig.peg.description;

