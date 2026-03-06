/**
 * Centralized token configuration
 * This file defines all token names, symbols, and peg-related text
 * to make the frontend generic and configurable.
 * 
 * Configuration can be overridden via environment variables:
 * - NEXT_PUBLIC_PROTOCOL_NAME: Protocol name (default: GLUON GOLD)
 * - NEXT_PUBLIC_NEUTRON_TICKER: Stable token symbol (default: GAU)
 * - NEXT_PUBLIC_PROTON_TICKER: Volatile token symbol (default: GAUC)
 * - NEXT_PUBLIC_PEG_ASSET: Peg asset name (default: Gold)
 * - NEXT_PUBLIC_PEG_UNIT: Peg unit (default: 1g)
 * - NEXT_PUBLIC_PEG_DESCRIPTION: Peg description (default: "Pegged to 1 gram of gold.")
 */

export interface TokenConfig {
  // Protocol name
  protocolName: string;
  
  // Base asset (e.g., ERG)
  baseAsset: {
    name: string;
    symbol: string;
  };
  
  // Stable asset (internally referred to as neutron)
  stableAsset: {
    name: string;
    symbol: string;
    displayName: string; // Full display name
    description: string; // Description text
  };
  
  // Volatile asset (internally referred to as proton)
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

// Read configuration from environment variables with defaults
const protocolName = process.env.NEXT_PUBLIC_PROTOCOL_NAME || "GLUON GOLD";
const neutronTicker = process.env.NEXT_PUBLIC_NEUTRON_TICKER || "GAU";
const protonTicker = process.env.NEXT_PUBLIC_PROTON_TICKER || "GAUC";
const pegAsset = process.env.NEXT_PUBLIC_PEG_ASSET || "Gold";
const pegUnit = process.env.NEXT_PUBLIC_PEG_UNIT || "1g";

/**
 * Smart formatting for peg asset names.
 * Currency codes (USD, EUR, etc.) stay uppercase.
 * Commodity names (Gold, Silver, etc.) become lowercase for sentences.
 */
const formatPegAssetForSentence = (asset: string): string => {
  // Check if it's likely a currency code:
  // - 2-4 characters
  // - All uppercase or title case
  // - Common currency codes
  const currencyCodes = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'CNY', 'INR'];
  
  if (currencyCodes.includes(asset.toUpperCase())) {
    return asset.toUpperCase();
  }
  
  // If it's 2-4 chars and all uppercase, assume it's a currency code
  if (asset.length >= 2 && asset.length <= 4 && asset === asset.toUpperCase()) {
    return asset;
  }
  
  // Otherwise, it's a commodity name - lowercase it
  return asset.toLowerCase();
};

// Smart description generation:
// If pegUnit already contains the asset (like "1 USD"), don't add "of {asset}"
// If pegUnit is just a quantity (like "1g"), add "of {asset}"
const generateStableDescription = () => {
  const unitLower = pegUnit.toLowerCase();
  const assetLower = pegAsset.toLowerCase();
  
  // Check if pegUnit already contains the asset name
  if (unitLower.includes(assetLower)) {
    return `The stablecoin pegged to ${pegUnit}.`;
  }
  
  // For quantities like "1g", "1oz", add "of {asset}"
  const formattedAsset = formatPegAssetForSentence(pegAsset);
  return `The stablecoin pegged to ${pegUnit} of ${formattedAsset}.`;
};

const pegDescription = process.env.NEXT_PUBLIC_PEG_DESCRIPTION || 
  (pegUnit.toLowerCase().includes(pegAsset.toLowerCase()) 
    ? `Pegged to ${pegUnit}.`
    : `Pegged to ${pegUnit} of ${formatPegAssetForSentence(pegAsset)}.`);

// Protocol configuration - configurable via environment variables
export const tokenConfig: TokenConfig = {
  protocolName,
  baseAsset: {
    name: "Ergo",
    symbol: "ERG",
  },
  stableAsset: {
    name: neutronTicker,
    symbol: neutronTicker,
    displayName: neutronTicker,
    description: generateStableDescription(),
  },
  volatileAsset: {
    name: protonTicker,
    symbol: protonTicker,
    displayName: protonTicker,
    description: "Tokenizes the reserve surplus and provides leveraged volatility and yield.",
  },
  peg: {
    type: pegAsset,
    unit: pegUnit,
    description: pegDescription,
  },
  pairToken: {
    name: `${neutronTicker}-${protonTicker} Pair`,
    symbol: `${neutronTicker}-${protonTicker}`,
  },
};

// Helper functions to get token symbols (for backward compatibility during migration)
export const getStableAssetSymbol = (): string => tokenConfig.stableAsset.symbol;
export const getVolatileAssetSymbol = (): string => tokenConfig.volatileAsset.symbol;
export const getPairTokenSymbol = (): string => tokenConfig.pairToken.symbol;
export const getBaseAssetSymbol = (): string => tokenConfig.baseAsset.symbol;

// Helper to get peg description
export const getPegDescription = (): string => tokenConfig.peg.description;

/**
 * Format peg asset for use in sentences.
 * Preserves uppercase for currency codes (USD, EUR), uses lowercase for commodities (gold, silver).
 */
export const formatPegAsset = (): string => {
  const asset = tokenConfig.peg.type;
  const currencyCodes = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'CNY', 'INR', 'BTC', 'ETH'];
  
  if (currencyCodes.includes(asset.toUpperCase())) {
    return asset.toUpperCase();
  }
  
  // If it's 2-4 chars and all uppercase, assume it's a currency code
  if (asset.length >= 2 && asset.length <= 4 && asset === asset.toUpperCase()) {
    return asset;
  }
  
  // Otherwise, it's a commodity name - lowercase it
  return asset.toLowerCase();
};

