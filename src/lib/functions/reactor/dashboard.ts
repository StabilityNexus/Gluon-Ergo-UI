/**
 * @file dashboard.ts
 * @description Pure bigint helpers for dashboard volume aggregation and series formatting.
 * @module lib/functions/reactor
 */

import { formatUnits } from "@/lib/utils/amounts";

const NANOERG_DECIMALS = 9;
export const VOLUME_BUCKETS = 14;

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
  if (plus.length === 0 && minus.length === 0) return [];

  const points: VolumeSeriesPoint[] = [];
  for (let i = VOLUME_BUCKETS - 1; i >= 0; i--) {
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
 * Formats VolumeChart Y-axis ticks with adaptive precision for small ERG volumes
 * and compact notation for large volumes.
 */
export function formatVolumeTick(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "0";
  const abs = Math.abs(value);
  if (abs < 0.01) return value.toFixed(4);
  if (abs < 0.1) return value.toFixed(3);
  if (abs < 10) return value.toFixed(2);
  if (abs < 1000) return value.toFixed(1);
  return `${(value / 1000).toFixed(1)}k`;
}

/**
 * Formats a fraction (e.g. 0.25) as a percentage string with one decimal place ("25.0").
 */
export function formatFractionPercent(fraction: number): string {
  if (!Number.isFinite(fraction)) return "—";
  return (fraction * 100).toFixed(1);
}
