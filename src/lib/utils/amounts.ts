/**
 * @file amounts.ts
 * @description Precise base-unit conversions without floating-point arithmetic.
 * @module lib/utils
 */

/**
 * Converts a decimal string to integer base units (e.g. "1.5" with 9 decimals -> 1500000000n).
 * Fractional digits beyond decimals are truncated.
 */
export function toBaseUnits(text: string, decimals: number): bigint {
  if (decimals < 0 || !Number.isInteger(decimals)) {
    throw new Error("decimals must be a non-negative integer");
  }

  const trimmed = text.trim();
  if (!trimmed || trimmed === ".") {
    return 0n;
  }

  const isNegative = trimmed.startsWith("-");
  const clean = isNegative ? trimmed.slice(1) : trimmed;

  const match = clean.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) {
    throw new Error(`Invalid decimal string: "${text}"`);
  }

  const [, wholePart, fracPart = ""] = match;

  let paddedFrac: string;
  if (fracPart.length > decimals) {
    paddedFrac = fracPart.slice(0, decimals);
  } else {
    paddedFrac = fracPart.padEnd(decimals, "0");
  }

  const combined = (wholePart === "0" ? "" : wholePart) + paddedFrac;
  const result = combined === "" ? 0n : BigInt(combined);

  return isNegative ? -result : result;
}

/**
 * Formats an integer base unit to a decimal string (e.g. 1500000000n with 9 decimals -> "1.5").
 * Trailing zeros after the decimal point are removed.
 */
export function formatUnits(value: bigint, decimals: number): string {
  if (decimals < 0 || !Number.isInteger(decimals)) {
    throw new Error("decimals must be a non-negative integer");
  }

  const isNegative = value < 0n;
  const absValue = isNegative ? -value : value;
  const str = absValue.toString();

  if (decimals === 0) {
    return (isNegative ? "-" : "") + str;
  }

  const padded = str.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals);
  let frac = padded.slice(padded.length - decimals);

  frac = frac.replace(/0+$/, "");
  const formatted = frac.length > 0 ? `${whole}.${frac}` : whole;

  return isNegative ? `-${formatted}` : formatted;
}
