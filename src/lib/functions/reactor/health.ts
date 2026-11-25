/**
 * @file health.ts
 * @description Pure bigint helpers for formatting reactor fusion ratio, healthy band geometry, peg drift, and ERG prices.
 * @module lib/functions/reactor
 */

import type { GluonDeployment, ProtocolSnapshot } from "@stability-nexus/gluon-ergo-sdk";
import { formatUnits } from "@/lib/utils/amounts";

/** Scale factor for fusion ratio q (10^9 = 100%). */
export const Q_SCALE = 1_000_000_000n;

/** Lower bound of the healthy fusion ratio band (0.50). */
export const HEALTHY_Q_MIN = 500_000_000n;

/** Upper bound of the healthy fusion ratio band (0.98). */
export const HEALTHY_Q_MAX = 980_000_000n;

const HEALTHY_MIN_PERCENT = 50n;
const HEALTHY_MAX_PERCENT = 98n;
const Q_ONE_TENTH_PERCENT = 1_000_000n;
const Q_ONE_PERCENT = 10_000_000n;

export interface BandPosition {
  /** Clamped fill percentage in [0n, 100n] computed strictly in bigint math. */
  percent: bigint;
  /** Healthy band lower marker percentage (50n). */
  minPercent: bigint;
  /** Healthy band upper marker percentage (98n). */
  maxPercent: bigint;
}

export interface PegTargetDescription {
  text: string;
}

/**
 * Formats fusion ratio q (scaled by 1e9) as a percentage string with one decimal place,
 * rounded half up using bigint arithmetic (e.g., 600_000_000n -> "60.0").
 */
export function formatQPercent(q: bigint): string {
  const isNegative = q < 0n;
  const absQ = isNegative ? -q : q;
  const tenths = (absQ + Q_ONE_TENTH_PERCENT / 2n) / Q_ONE_TENTH_PERCENT;
  const whole = tenths / 10n;
  const frac = tenths % 10n;
  const prefix = isNegative && tenths > 0n ? "-" : "";
  return `${prefix}${whole.toString()}.${frac.toString()}`;
}

/**
 * Returns whether q lies inside the inclusive healthy band [0.50, 0.98].
 */
export function isInBand(q: bigint): boolean {
  return q >= HEALTHY_Q_MIN && q <= HEALTHY_Q_MAX;
}

/**
 * Computes integer percent values (0..100) for the fusion ratio bar and healthy band markers
 * strictly in bigint math. Callers convert to a JS number or CSS string only at the final style value.
 */
export function bandPosition(q: bigint): BandPosition {
  if (q <= 0n) {
    return {
      percent: 0n,
      minPercent: HEALTHY_MIN_PERCENT,
      maxPercent: HEALTHY_MAX_PERCENT,
    };
  }

  const rounded = (q + Q_ONE_PERCENT / 2n) / Q_ONE_PERCENT;
  const clamped = rounded > 100n ? 100n : rounded;

  return {
    percent: clamped,
    minPercent: HEALTHY_MIN_PERCENT,
    maxPercent: HEALTHY_MAX_PERCENT,
  };
}

/**
 * Formats (pegFactor / initialPegFactor) as a percentage with one decimal place,
 * rounded half up in bigint math (e.g., 990_000_000n / 1_000_000_000n -> "99.0").
 * Returns "—" when initialPegFactor is 0n or negative.
 */
export function formatDriftPercent(pegFactor: bigint, initialPegFactor: bigint): string {
  if (initialPegFactor <= 0n) {
    return "—";
  }

  const isNegative = pegFactor < 0n;
  const absPeg = isNegative ? -pegFactor : pegFactor;
  const tenths = (absPeg * 1000n + initialPegFactor / 2n) / initialPegFactor;
  const whole = tenths / 10n;
  const frac = tenths % 10n;
  const prefix = isNegative && tenths > 0n ? "-" : "";
  return `${prefix}${whole.toString()}.${frac.toString()}`;
}

/**
 * Formats (pegFactor / initialPegFactor) as a decimal multiplier with three decimal places,
 * rounded half up in bigint math (e.g., 990_000_000n / 1_000_000_000n -> "0.990").
 * Returns "—" when initialPegFactor is 0n or negative.
 */
export function formatDriftRatio(pegFactor: bigint, initialPegFactor: bigint): string {
  if (initialPegFactor <= 0n) {
    return "—";
  }

  const isNegative = pegFactor < 0n;
  const absPeg = isNegative ? -pegFactor : pegFactor;
  const thousandths = (absPeg * 1000n + initialPegFactor / 2n) / initialPegFactor;
  const whole = thousandths / 1000n;
  const frac = (thousandths % 1000n).toString().padStart(3, "0");
  const prefix = isNegative && thousandths > 0n ? "-" : "";
  return `${prefix}${whole.toString()}.${frac}`;
}

/**
 * Formats a nanoERG price value as "<decimal> ERG".
 */
export function formatErgPrice(nano: bigint): string {
  return `${formatUnits(nano, 9)} ERG`;
}

/**
 * Builds the neutron peg-target description from the current peg-factor drift ratio
 * and deployment.peg without ever claiming "pegged to 1 USD".
 */
export function describePegTarget(
  snapshot: Pick<ProtocolSnapshot, "pegFactor" | "initialPegFactor">,
  deployment: GluonDeployment
): PegTargetDescription {
  const neutronTicker = deployment.tokens.neutron.name;
  const ratio = formatDriftRatio(snapshot.pegFactor, snapshot.initialPegFactor);
  const pegUnit = deployment.peg.trim();

  if (ratio === "—") {
    return { text: `1 ${neutronTicker} targets — × (${pegUnit})` };
  }

  return { text: `1 ${neutronTicker} targets ${ratio} × (${pegUnit})` };
}

