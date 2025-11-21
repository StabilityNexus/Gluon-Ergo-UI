import { TOKEN_ADDRESS } from "@/lib/constants/token";
import BigNumber from "bignumber.js";

// Configure BigNumber globally for crypto-safe operations
BigNumber.config({
  DECIMAL_PLACES: 9, // Maximum blockchain precision
  ROUNDING_MODE: BigNumber.ROUND_DOWN, // Always round down for crypto safety
  EXPONENTIAL_AT: [-9, 20], // Force decimal notation for small numbers
  FORMAT: {
    decimalSeparator: ".",
    groupSeparator: ",",
    groupSize: 3,
    secondaryGroupSize: 0,
    fractionGroupSeparator: " ",
    fractionGroupSize: 0,
  },
});

interface FormattedNumber {
  display: string; // User-friendly display value
  tooltip: string; // Full precision value for tooltips
  raw: string; // Raw value without any formatting
}

/**
 * Converts a value from decimal representation (e.g., from blockchain)
 * @param value - Raw number from blockchain
 * @param decimals - Number of decimals (defaults to TOKEN_ADDRESS.decimals)
 */
export const convertFromDecimals = (value: number | bigint | string, decimals: number = TOKEN_ADDRESS.decimals): BigNumber => {
  const bn = new BigNumber(value.toString());
  return bn.dividedBy(new BigNumber(10).pow(decimals));
};

/**
 * Converts a value to decimal representation (e.g., for blockchain)
 * @param value - Human readable number
 * @param decimals - Number of decimals (defaults to TOKEN_ADDRESS.decimals)
 */
export const convertToDecimals = (value: number | string, decimals: number = TOKEN_ADDRESS.decimals): bigint => {
  // Ensure value is a valid number, default to '0' if not
  const valueStr = (typeof value === "string" && value.trim() === "") || value === null || value === undefined || Number.isNaN(Number(value)) ? "0" : value.toString();

  const bn = new BigNumber(valueStr);
  const multiplied = bn.times(new BigNumber(10).pow(decimals));
  return BigInt(multiplied.integerValue(BigNumber.ROUND_DOWN).toString());
};

/**
 * Formats numbers for macro display (statistics, overviews)
 * Uses full words for millions and above, K for thousands
 * Always rounds down for crypto safety
 */
export const formatMacroNumber = (value: number | string | BigNumber): FormattedNumber => {
  const bn = new BigNumber(value.toString());
  if (bn.isZero()) return { display: "0", tooltip: "0", raw: "0" };

  const absValue = bn.abs();
  const trillion = new BigNumber(1000000000000);
  const billion = new BigNumber(1000000000);
  const million = new BigNumber(1000000);
  const thousand = new BigNumber(1000);

  let display: string;
  if (absValue.gte(trillion)) {
    display = `${bn.dividedBy(trillion).decimalPlaces(2, BigNumber.ROUND_DOWN)}T`;
  } else if (absValue.gte(billion)) {
    display = `${bn.dividedBy(billion).decimalPlaces(2, BigNumber.ROUND_DOWN)}B`;
  } else if (absValue.gte(million)) {
    display = `${bn.dividedBy(million).decimalPlaces(2, BigNumber.ROUND_DOWN)}M`;
  } else if (absValue.gte(thousand)) {
    display = `${bn.dividedBy(thousand).decimalPlaces(2, BigNumber.ROUND_DOWN)}K`;
  } else {
    display = bn.decimalPlaces(2, BigNumber.ROUND_DOWN).toString();
  }

  return {
    display,
    tooltip: bn.toFormat(),
    raw: bn.toString(),
  };
};

/**
 * Formats numbers for micro display (exact amounts)
 * Shows exact values with proper decimal handling
 * Never rounds up, always truncates
 */
export const formatMicroNumber = (value: number | string | BigNumber): FormattedNumber => {
  const bn = new BigNumber(value.toString());
  if (bn.isZero()) return { display: "0", tooltip: "0", raw: "0" };

  // For all values, show up to 9 decimal places (removing trailing zeros)
  const truncated = bn.decimalPlaces(9, BigNumber.ROUND_DOWN);
  const formatted = truncated.toFixed();

  // Remove trailing zeros after decimal point
  const parts = formatted.split(".");
  if (parts.length === 2) {
    const trimmed = parts[1].replace(/0+$/, "");
    const display = trimmed ? `${parts[0]}.${trimmed}` : parts[0];
    return {
      display,
      tooltip: bn.toFormat(9),
      raw: bn.toString(),
    };
  }

  return {
    display: formatted,
    tooltip: bn.toFormat(9),
    raw: bn.toString(),
  };
};

export const formatApprox = (value: number | string | BigNumber): string => {
  return formatMacroNumber(value).display;
}

export const format = (value: number | string | BigNumber): string => {
  return formatMicroNumber(value).display;
}

/**
 * Main formatting function that decides between macro and micro formatting
 * @param value - Number to format
 * @param isMacro - Force macro formatting for statistics displays
 */
export const formatNumber = (value: number | string | BigNumber, isMacro: boolean = false): FormattedNumber => {
  return isMacro ? formatMacroNumber(value) : formatMicroNumber(value);
};

export const nanoErgsToErgs = (nanoErgs: number | bigint | string): BigNumber => {
  return new BigNumber(nanoErgs.toString()).dividedBy(new BigNumber(10).pow(9));
};

export const ergsToNanoErgs = (ergs: number | string): bigint => {
  const bn = new BigNumber(ergs.toString());
  const multiplied = bn.times(new BigNumber(10).pow(9));
  return BigInt(multiplied.integerValue(BigNumber.ROUND_DOWN).toString());
};

export const UIFriendlyValue = (input: number | bigint | string, divisor?: number): BigNumber => {
  const bn = new BigNumber(input.toString());
  return bn.dividedBy(new BigNumber(10).pow(divisor ?? 9));
};

export const APIFriendlyValue = (input: number | string, divisor?: number): bigint => {
  const bn = new BigNumber(input.toString());
  const multiplied = bn.times(new BigNumber(10).pow(divisor ?? 9));
  return BigInt(multiplied.integerValue(BigNumber.ROUND_DOWN).toString());
};
