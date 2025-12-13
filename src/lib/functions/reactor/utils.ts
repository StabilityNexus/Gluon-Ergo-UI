import { TOKEN_ADDRESS } from "@/lib/constants/token";
import { Token, TokenSymbol, SwapAction } from "./types";
import { tokenConfig } from "@/config/tokenConfig";
import BigNumber from "bignumber.js";

export const VALID_PAIRS = [
  { from: "ERG", to: tokenConfig.pairToken.symbol },
  { from: tokenConfig.pairToken.symbol, to: "ERG" },
  { from: tokenConfig.stableAsset.symbol, to: tokenConfig.volatileAsset.symbol },
  { from: tokenConfig.volatileAsset.symbol, to: tokenConfig.stableAsset.symbol },
] as const;

export const defaultTokens: Token[] = [
  {
    symbol: "ERG",
    name: tokenConfig.baseAsset.name,
    color: "bg-blue-500",
    balance: "0",
    tokenId: "ERG",
    decimals: 9, // Full blockchain precision
  },
  {
    symbol: tokenConfig.stableAsset.symbol as TokenSymbol,
    name: tokenConfig.stableAsset.displayName,
    color: "bg-yellow-500",
    balance: "0",
    tokenId: TOKEN_ADDRESS.stableAsset,
    decimals: 9, // Full blockchain precision
  },
  {
    symbol: tokenConfig.volatileAsset.symbol as TokenSymbol,
    name: tokenConfig.volatileAsset.displayName,
    color: "bg-red-500",
    balance: "0",
    tokenId: TOKEN_ADDRESS.volatileAsset,
    decimals: 9, // Full blockchain precision
  },
  {
    symbol: tokenConfig.pairToken.symbol as TokenSymbol,
    name: tokenConfig.pairToken.name,
    color: "bg-purple-500",
    balance: "0",
    tokenId: `${tokenConfig.pairToken.symbol}_PAIR_TOKEN_ID_PLACEHOLDER`,
    decimals: 9, // Full blockchain precision
  },
];

export const getValidToTokens = (fromSymbol: TokenSymbol, tokens: Token[]): Token[] => {
  const pairSymbol = tokenConfig.pairToken.symbol;
  const stableSymbol = tokenConfig.stableAsset.symbol;
  const volatileSymbol = tokenConfig.volatileAsset.symbol;
  
  if (fromSymbol === "ERG") {
    return tokens.filter((t) => t.symbol === pairSymbol);
  }
  if (fromSymbol === pairSymbol) {
    return tokens.filter((t) => t.symbol === "ERG");
  }
  if (fromSymbol === stableSymbol) {
    return tokens.filter((t) => t.symbol === volatileSymbol);
  }
  if (fromSymbol === volatileSymbol) {
    return tokens.filter((t) => t.symbol === stableSymbol);
  }
  return [];
};

export const getActionType = (fromSymbol: TokenSymbol, toSymbol: TokenSymbol): SwapAction | null => {
  const pairSymbol = tokenConfig.pairToken.symbol;
  const stableSymbol = tokenConfig.stableAsset.symbol;
  const volatileSymbol = tokenConfig.volatileAsset.symbol;
  
  if (fromSymbol === "ERG" && toSymbol === pairSymbol) return "erg-to-pair";
  if (fromSymbol === pairSymbol && toSymbol === "ERG") return "pair-to-erg";
  if (fromSymbol === volatileSymbol && toSymbol === stableSymbol) return "volatile-to-stable";
  if (fromSymbol === stableSymbol && toSymbol === volatileSymbol) return "stable-to-volatile";
  return null;
};

export const getDescription = (action: SwapAction | null): string => {
  const stableName = tokenConfig.stableAsset.displayName;
  const volatileName = tokenConfig.volatileAsset.displayName;
  
  switch (action) {
    case "erg-to-pair":
      return `You are using fission to convert ERG into ${stableName} and ${volatileName}.`;
    case "pair-to-erg":
      return `You are using fusion to convert ${stableName} and ${volatileName} into ERG.`;
    case "volatile-to-stable":
      return `You are using transmutation to convert ${volatileName} into ${stableName}.`;
    case "stable-to-volatile":
      return `You are using transmutation to convert ${stableName} into ${volatileName}.`;
    default:
      return "Select tokens to swap.";
  }
};

export const getTitle = (action: SwapAction | null): string => {
  switch (action) {
    case "erg-to-pair":
      return "FISSION";
    case "pair-to-erg":
      return "FUSION";
    case "volatile-to-stable":
    case "stable-to-volatile":
      return "TRANSMUTATION";
    default:
      return "REACTOR";
  }
};

export const validateAmount = (amount: string): string | null => {
  if (!amount) return "Amount cannot be empty";
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) return "Invalid number";
  if (numAmount <= 0) return "Amount must be greater than 0";
  return null;
};

export const formatValue = (value: number | BigNumber | undefined): string => {
  if (value === undefined) return "0";
  if (typeof value === "number" && isNaN(value)) return "0";
  return value.toString();
};
