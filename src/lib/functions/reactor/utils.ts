import { TOKEN_ADDRESS } from "@/lib/constants/token";
import { Token, TokenSymbol, SwapAction } from "./types";
import BigNumber from "bignumber.js";

export const VALID_PAIRS = [
  { from: "ERG", to: "GAU-GAUC" },
  { from: "GAU-GAUC", to: "ERG" },
  { from: "GAU", to: "GAUC" },
  { from: "GAUC", to: "GAU" },
] as const;

export const defaultTokens: Token[] = [
  {
    symbol: "ERG",
    name: "Ergo",
    color: "bg-blue-500",
    balance: "0",
    tokenId: "ERG",
    decimals: 9, // Full blockchain precision
  },
  {
    symbol: "GAU",
    name: "Gluon Gold",
    color: "bg-yellow-500",
    balance: "0",
    tokenId: TOKEN_ADDRESS.gau,
    decimals: 3,
  },
  {
    symbol: "GAUC",
    name: "Gluon Gold Certificate",
    color: "bg-red-500",
    balance: "0",
    tokenId: TOKEN_ADDRESS.gauc,
    decimals: 3,
  },
  {
    symbol: "GAU-GAUC",
    name: "Gluon Pair",
    color: "bg-purple-500",
    balance: "0",
    tokenId: "GAU-GAUC_PAIR_TOKEN_ID_PLACEHOLDER",
    decimals: 3,
  },
];

export const getValidToTokens = (fromSymbol: TokenSymbol, tokens: Token[]): Token[] => {
  if (fromSymbol === "ERG") {
    return tokens.filter((t) => t.symbol === "GAU-GAUC");
  }
  if (fromSymbol === "GAU-GAUC") {
    return tokens.filter((t) => t.symbol === "ERG");
  }
  if (fromSymbol === "GAU") {
    return tokens.filter((t) => t.symbol === "GAUC");
  }
  if (fromSymbol === "GAUC") {
    return tokens.filter((t) => t.symbol === "GAU");
  }
  return [];
};

export const getActionType = (fromSymbol: TokenSymbol, toSymbol: TokenSymbol): SwapAction | null => {
  if (fromSymbol === "ERG" && toSymbol === "GAU-GAUC") return "erg-to-gau-gauc";
  if (fromSymbol === "GAU-GAUC" && toSymbol === "ERG") return "gau-gauc-to-erg";
  if (fromSymbol === "GAUC" && toSymbol === "GAU") return "gauc-to-gau";
  if (fromSymbol === "GAU" && toSymbol === "GAUC") return "gau-to-gauc";
  return null;
};

export const getDescription = (action: SwapAction | null): string => {
  switch (action) {
    case "erg-to-gau-gauc":
      return "You are using fission to convert ERG into GAU and GAUC.";
    case "gau-gauc-to-erg":
      return "You are using fusion to convert GAU and GAUC into ERG.";
    case "gauc-to-gau":
      return "You are using transmutation to convert GAUC into GAU.";
    case "gau-to-gauc":
      return "You are using transmutation to convert GAU into GAUC.";
    default:
      return "Select tokens to swap.";
  }
};

export const getTitle = (action: SwapAction | null): string => {
  switch (action) {
    case "erg-to-gau-gauc":
      return "FISSION";
    case "gau-gauc-to-erg":
      return "FUSION";
    case "gauc-to-gau":
    case "gau-to-gauc":
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
