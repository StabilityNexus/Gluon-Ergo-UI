/**
 * @file dashboard.ts
 * @description Pure bigint helpers for dashboard volume aggregation and series formatting.
 * @module lib/functions/reactor
 */

import { formatUnits } from "@/lib/utils/amounts";

const NANOERG_DECIMALS = 9;

export interface VolumeSeriesPoint {
  day: string;
  /** Protons -> Neutrons (betaDecayPlus) volume in ERG */
  plusErg: number;
  /** Neutrons -> Protons (betaDecayMinus) volume in ERG */
  minusErg: number;
  /** Raw nanoERG values for exact tooltip formatting */
  plusNano: bigint;
  minusNano: bigint;
}

/**
 * Sums the first `days` volume buckets (index 0 = current 720-block bucket).
 */
export function sumVolumeBuckets(buckets: readonly bigint[], days: 1 | 7 | 14): bigint {
  const limit = Math.min(days, buckets.length);
  let total = 0n;
  for (let i = 0; i < limit; i++) {
    total += buckets[i] ?? 0n;
  }
  return total;
}

/**
 * Converts 14-day bucket arrays (index 0 = current bucket) into chronological chart points
 * ordered oldest -> Today.
 */
export function buildVolumeSeries(
  plus: readonly bigint[],
  minus: readonly bigint[]
): VolumeSeriesPoint[] {
  const len = Math.max(plus.length, minus.length);
  if (len === 0) return [];

  const points: VolumeSeriesPoint[] = [];
  for (let i = len - 1; i >= 0; i--) {
    const plusNano = plus[i] ?? 0n;
    const minusNano = minus[i] ?? 0n;
    const day = i === 0 ? "Today" : `${i}d ago`;
    points.push({
      day,
      plusErg: Number(formatUnits(plusNano, NANOERG_DECIMALS)),
      minusErg: Number(formatUnits(minusNano, NANOERG_DECIMALS)),
      plusNano,
      minusNano,
    });
  }
  return points;
}

/**
 * Formats a fraction (e.g. 0.25) as a percentage string with one decimal place ("25.0").
 */
export function formatFractionPercent(fraction: number): string {
  if (!Number.isFinite(fraction)) return "—";
  return (fraction * 100).toFixed(1);
}
