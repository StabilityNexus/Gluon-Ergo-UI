/**
 * @file useGluonFeeBreakdown.ts
 * @description Reconstructs cumulative Gluon Gold protocol fees, split into
 * Fission / Fusion / Beta Decay / Oracle categories, from on-chain box history.
 *
 * WHY THIS EXISTS
 * The existing `feePaidErg` proxy in useGluonTransactionHistory.ts is
 * `max(0, ergValue - prevErgValue)` — it treats every reserve inflow (including
 * plain deposits) as a "fee". That's fine for a rough disclaimer-laden yield
 * estimate, but Bruno explicitly asked for real per-category fee accounting,
 * so this module reconstructs the actual protocol economics instead.
 *
 * CORE IDEA
 * Every Gluon box mutation (fission / fusion / beta decay) is fully determined
 * by the box's OWN state deltas — we don't need a separate transaction-fetch
 * pipeline. Classification (see classifyTransition):
 *
 *   Δvalue > 0, Δneutron < 0, Δproton < 0   -> Fission
 *   Δvalue < 0, Δneutron > 0, Δproton > 0   -> Fusion
 *   Δvalue ≈ 0, Δneutron > 0, Δproton < 0   -> Beta decay (neutron -> proton)
 *   Δvalue ≈ 0, Δneutron < 0, Δproton > 0   -> Beta decay (proton -> neutron)
 *
 * This holds because in gluon-ergo-sdk's gluon.ts, `fission()`/`fusion()` are
 * the only functions that mutate `box.value`; `transmuteToProton()` /
 * `transmuteToNeutron()` never touch it (decay fees are paid via a separate
 * user-funded fee box, not by draining the gluon box).
 *
 * WHY WE REUSE THE REAL SDK INSTEAD OF REIMPLEMENTING FORMULAS
 * gluon-ergo-sdk's Serializer decodes registers from the RAW `serializedValue`
 * via the real ergo-lib-wasm library — not from Explorer's `renderedValue`.
 * That means we can feed historical boxes straight into the SDK's own
 * GluonBox / PegOracleBox / Gluon classes and call the exact fee formulas
 * Bruno already trusts, instead of hand-rolling the fee-curve math (which is
 * exactly the kind of assumption that caused the earlier oracle-price bug).
 *
 * The SDK's GluonBox expects the NODE API box shape (registers as plain hex
 * strings). Explorer returns registers as { serializedValue, sigmaType,
 * renderedValue } objects, so `adaptToNodeBox()` below reshapes each box
 * before constructing a GluonBox/PegOracleBox from it.
 *
 * FEE ATTRIBUTION CONVENTION (a judgment call — confirm with Bruno)
 *   - Dev fee is charged on every action type; it's folded into whichever
 *     bucket triggered it (Fission/Fusion/Beta Decay), read as the EXACT
 *     diff of the R6 register's cumulative dev-fee-paid counter. No modeling.
 *   - Oracle fee only ever fires on beta-decay (transmutation) transactions,
 *     but Bruno wants it broken out as its own 4th bucket, so it's pulled OUT
 *     of the Beta Decay total into a separate line (computed via the SDK's
 *     real getTotalFeeAmountTransmuteToProton/Neutron).
 *   - Fission/Fusion "dilution value" (the 0.1% / 0.5% fewer tokens minted or
 *     more tokens burned than the fee-free amount) is an EXACT algebraic
 *     shortfall, valued at that block's real neutron/proton price.
 *   - Beta-decay dilution value is an ESTIMATE: SDK's real varPhiBeta() rate
 *     (0.5% base + volume slope, exact formula) × the ERG-equivalent volume
 *     transmuted. This is a rate-based estimate, not an exact token-shortfall
 *     derivation like fission/fusion — flagged as such in the returned data.
 *
 * KNOWN LIMITATION
 * The contract migration boundary (~height 1397584, address change) is
 * skipped rather than classified — it's a redeploy, not a user transaction,
 * and forcing it through the classifier would misattribute its deltas.
 */

import { useEffect, useState } from "react";
import type { GluonBox as GluonBoxType, Gluon as GluonType, PegOracleBox as PegOracleBoxType } from "gluon-ergo-sdk";

const DEBUG = false;
const logDebug = (...args: unknown[]) => {
  if (DEBUG) console.log(...args);
};
const warnDebug = (...args: unknown[]) => {
  if (DEBUG) console.warn(...args);
};

const EXPLORER_BASE = "https://api.ergoplatform.com/api/v1";
const PAGE_SIZE = 100;
const BLOCK_TIME_MS = 120_000;
const CACHE_KEY = "gluon_fee_breakdown_v9";
const CACHE_TTL_MS = 30 * 60 * 1000;

const NEUTRON_ID = "886b7721bef42f60c6317d37d8752da8aca01898cae7dae61808c4a14225edc8";
const PROTON_ID = "9944ff273ff169f32b851b96bbecdbb67f223101c15ae143de82b3e7f75b19d2";
const ORACLE_POOL_NFT = "3c45f29a5165b030fdb5eaf5d81f8108f9d8f507b31487dd51f4ae08fe07cf4a";

// Registers that must ALL be present for GluonBox's register-index logic to
// line up correctly (it filters out empty registers positionally, so a
// missing register silently shifts every subsequent index).
const REQUIRED_REGISTERS = ["R4", "R5", "R6", "R7", "R8", "R9"];

// Tolerance for treating a box's ERG value as "unchanged" across a transmutation
// transition (miner-fee dust, rounding). 0.002 ERG.
const BETA_DECAY_FLAT_TOLERANCE_NANOERG = 2_000_000;
// Fission/fusion classification is decided by SIGN (which token amounts
// decreased vs increased), not magnitude — a fission of 0.0003 ERG is just as
// real as one of 300 ERG. This only exists to keep fission/fusion from ever
// overlapping with the transmutation "flat" zone at dValue === 0 exactly.
const FISSION_FUSION_MIN_VALUE_NANOERG = 1;

export type FeeCategory =
  | "fission"
  | "fusion"
  | "transmuteNeutronToProton"
  | "transmuteProtonToNeutron"
  | "unknown";

export interface TransitionFee {
  height: number;
  timestamp: number;
  txId: string | null;
  category: FeeCategory;
  devFeeErg: number;
  dilutionValueErg: number;
  /** Only nonzero for transmutation transitions. Kept as its own bucket per Bruno's request. */
  oracleFeeErg: number;
  /** devFeeErg + dilutionValueErg (oracle fee is NOT included — it's its own bucket). */
  totalFeeErg: number;
  /** True only for the transmutation dilutionValueErg (rate × volume estimate, not an exact shortfall). */
  isEstimate: boolean;
  /** True when oracle price history has no sample near this transition height (price <= 0). */
  priceUnavailable?: boolean;
  /** Raw box-state deltas that drove classification, exposed for debugging —
   * especially for `category === "unknown"` rows, so patterns can be
   * inspected in bulk instead of digging through console.warn calls. */
  rawDeltaValueNanoErg: number;
  rawDeltaNeutron: number;
  rawDeltaProton: number;
}

export interface CumulativeFeePoint {
  height: number;
  timestamp: number;
  fission: number;
  fusion: number;
  transmuteNeutronToProton: number;
  transmuteProtonToNeutron: number;
  oracle: number;
  estimatedNeutronToProton: number;
  estimatedProtonToNeutron: number;
  betaDecay: number;
  estimated: number;
  total: number;
}

export interface UseGluonFeeBreakdownResult {
  points: CumulativeFeePoint[];
  transitions: TransitionFee[];
  loading: boolean;
  error: string | null;
  notes: string[];
}

interface ExplorerAsset {
  tokenId: string;
  amount: number;
}

interface ExplorerRegisterValue {
  serializedValue: string;
  sigmaType: string;
  renderedValue: string;
}

interface ExplorerBox {
  boxId: string;
  transactionId: string;
  creationHeight: number;
  value: number;
  assets: ExplorerAsset[];
  address: string;
  additionalRegisters: Record<string, ExplorerRegisterValue>;
  spentTransactionId: string | null;
}

interface CacheEntry {
  fetchedAt: number;
  points: CumulativeFeePoint[];
  transitions: TransitionFee[];
  notes: string[];
}

function readCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(entry: CacheEntry): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {}
}

async function fetchAllBoxesByToken(tokenId: string): Promise<ExplorerBox[]> {
  const all: ExplorerBox[] = [];
  let offset = 0;
  while (true) {
    const url = `${EXPLORER_BASE}/boxes/byTokenId/${tokenId}?limit=${PAGE_SIZE}&offset=${offset}&sortDirection=asc`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Explorer boxes fetch failed: ${res.status} at offset ${offset}`);
    const data = await res.json();
    const items: ExplorerBox[] = data.items || [];
    all.push(...items);
    if (items.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    if (all.length >= 10000) break; // safety limit
  }
  return all;
}

interface OraclePoint {
  height: number;
  goldPriceNanoErg: number; // per kg
}

/**
 * Fetches oracle box history sampled evenly across the entire blockchain lifespan.
 *
 * Explorer holds ~24,000 oracle boxes. Rather than fetching only the tail (~last 2000),
 * we sample batches of limit=100 across the entire offset range (0 to total),
 * yielding ~3,500 deduplicated price points from genesis (height ~1.1M) through
 * Gluon launch (height ~1.3M) to the latest block (~1.84M).
 */
async function fetchOracleHistory(): Promise<OraclePoint[]> {
  try {
    logDebug(`[FeeBreakdown] Fetching spanning oracle price history (NFT: ${ORACLE_POOL_NFT.slice(0, 8)}...)`);
    const initRes = await fetch(`${EXPLORER_BASE}/boxes/byTokenId/${ORACLE_POOL_NFT}?limit=1`);
    if (!initRes.ok) return [];
    const initData = await initRes.json();
    const total: number = initData.total || 0;
    if (total <= 0) return [];

    const numBatches = 35;
    const step = Math.max(100, Math.floor(total / numBatches));
    const offsets: number[] = [];
    for (let offset = 0; offset < total; offset += step) {
      offsets.push(offset);
    }
    if (offsets[offsets.length - 1] < total - 100) {
      offsets.push(Math.max(0, total - 100));
    }

    const batchResults = await Promise.all(
      offsets.map(async (offset) => {
        try {
          const res = await fetch(
            `${EXPLORER_BASE}/boxes/byTokenId/${ORACLE_POOL_NFT}?limit=100&offset=${offset}`
          );
          if (!res.ok) return [];
          const data = await res.json();
          const pts: OraclePoint[] = [];
          for (const box of data.items || []) {
            const r4 = box.additionalRegisters?.R4;
            if (r4 && r4.sigmaType === "SLong") {
              const price = Number(r4.renderedValue);
              if (price > 0 && !isNaN(price)) {
                pts.push({ height: box.creationHeight, goldPriceNanoErg: price });
              }
            }
          }
          return pts;
        } catch {
          return [];
        }
      })
    );

    const points = batchResults.flat();
    points.sort((a, b) => a.height - b.height);

    // Deduplicate by height
    const deduped: OraclePoint[] = [];
    let lastHeight = -1;
    for (const p of points) {
      if (p.height !== lastHeight) {
        deduped.push(p);
        lastHeight = p.height;
      }
    }

    logDebug(`[FeeBreakdown] Spanning oracle price points extracted: ${deduped.length}`);
    if (deduped.length > 0) {
      logDebug(
        `[FeeBreakdown] Oracle price range: ${(deduped[0].goldPriceNanoErg / 1e9).toFixed(1)} ERG/kg (height ${deduped[0].height}) → ${(deduped[deduped.length - 1].goldPriceNanoErg / 1e9).toFixed(1)} ERG/kg (height ${deduped[deduped.length - 1].height})`
      );
    }
    return deduped;
  } catch (err) {
    warnDebug("[FeeBreakdown] Oracle history fetch failed:", err);
    return [];
  }
}

function findNearestOraclePrice(oracleHistory: OraclePoint[], height: number): number {
  if (!oracleHistory || oracleHistory.length === 0) return 0;
  let lo = 0;
  let hi = oracleHistory.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (oracleHistory[mid].height < height) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0) {
    const before = oracleHistory[lo - 1];
    const after = oracleHistory[lo];
    if (before && after) {
      return Math.abs(before.height - height) <= Math.abs(after.height - height)
        ? before.goldPriceNanoErg
        : after.goldPriceNanoErg;
    }
  }
  return oracleHistory[lo]?.goldPriceNanoErg ?? 0;
}

interface AdaptedNodeBox {
  boxId: string;
  value: number;
  assets: ExplorerAsset[];
  additionalRegisters: Record<string, string>;
  creationHeight: number;
}

/** Reshape an Explorer-API box into the plain-hex-register shape GluonBox expects. */
function adaptToNodeBox(box: ExplorerBox): AdaptedNodeBox {
  const regs: Record<string, string> = {};
  for (const [k, v] of Object.entries(box.additionalRegisters || {})) {
    regs[k] = v.serializedValue;
  }
  return {
    boxId: box.boxId,
    value: box.value,
    assets: box.assets,
    additionalRegisters: regs,
    creationHeight: box.creationHeight,
  };
}

function hasAllRequiredRegisters(box: ExplorerBox): boolean {
  return REQUIRED_REGISTERS.every((r) => !!box.additionalRegisters?.[r]);
}

/** Duck-typed PegOracleBox — reuses the gold price scalar already extracted
 * from R4's renderedValue (proven reliable elsewhere in this codebase),
 * rather than round-tripping through a synthetic serialized register. */
function makePegOracleLike(goldPriceNanoErgPerKg: number): PegOracleBoxType {
  return {
    getPrice: async () => goldPriceNanoErgPerKg,
    getPricePerGram: async () => Math.floor(goldPriceNanoErgPerKg / 1000),
  } as unknown as PegOracleBoxType;
}

/**
 * Computes the fee breakdown for a single box transition using the SDK's
 * real GluonBox/Gluon classes. Returns null if the transition can't be
 * safely classified (missing registers, contract migration boundary).
 */
async function computeTransitionFee(
  sdkMod: typeof import("gluon-ergo-sdk"),
  gluon: GluonType,
  prevRaw: ExplorerBox,
  currRaw: ExplorerBox,
  goldPriceAtPrevHeight: number,
  timestamp: number,
): Promise<TransitionFee | null> {
  if (prevRaw.address !== currRaw.address) {
    // Contract migration boundary, not a user transaction — skip.
    return null;
  }
  if (!hasAllRequiredRegisters(prevRaw) || !hasAllRequiredRegisters(currRaw)) {
    warnDebug("[FeeBreakdown] Skipping transition — missing registers", prevRaw.boxId, "->", currRaw.boxId);
    return null;
  }

  const prevGluonBox: GluonBoxType = new sdkMod.GluonBox(adaptToNodeBox(prevRaw));
  const currGluonBox: GluonBoxType = new sdkMod.GluonBox(adaptToNodeBox(currRaw));

  const dValue = currRaw.value - prevRaw.value;
  const nPrev = prevRaw.assets.find((a) => a.tokenId === NEUTRON_ID)?.amount ?? 0;
  const nCurr = currRaw.assets.find((a) => a.tokenId === NEUTRON_ID)?.amount ?? 0;
  const pPrev = prevRaw.assets.find((a) => a.tokenId === PROTON_ID)?.amount ?? 0;
  const pCurr = currRaw.assets.find((a) => a.tokenId === PROTON_ID)?.amount ?? 0;
  const dNeutron = nCurr - nPrev;
  const dProton = pCurr - pPrev;

  // Dev fee: exact, from R6's cumulative dev-fee-paid counter.
  const [prevDevFeePaid] = await prevGluonBox.getFees();
  const [currDevFeePaid] = await currGluonBox.getFees();
  const devFeeErg = Math.max(0, currDevFeePaid - prevDevFeePaid) / 1e9;

  const base = {
    height: currRaw.creationHeight,
    timestamp,
    txId: prevRaw.spentTransactionId,
    rawDeltaValueNanoErg: dValue,
    rawDeltaNeutron: dNeutron,
    rawDeltaProton: dProton,
  };

  const isFission = dValue >= FISSION_FUSION_MIN_VALUE_NANOERG && dNeutron <= 0 && dProton <= 0;
  const isFusion = dValue <= -FISSION_FUSION_MIN_VALUE_NANOERG && dNeutron >= 0 && dProton >= 0;
  const isFlat = Math.abs(dValue) <= BETA_DECAY_FLAT_TOLERANCE_NANOERG;
  const isTransmuteNP = isFlat && dNeutron > 0 && dProton <= 0;
  const isTransmutePN = isFlat && dNeutron <= 0 && dProton > 0;

  // Reject the zero/negative oracle price sentinel before attempting any
  // price-dependent dilution or transmutation fee math. When price history has
  // no usable sample, findNearestOraclePrice returns 0; passing that into the SDK
  // would silently fabricate bogus zero/NaN prices.
  if (goldPriceAtPrevHeight <= 0) {
    warnDebug(
      `[FeeBreakdown] Oracle price unavailable (price <= 0: ${goldPriceAtPrevHeight}) at height ${prevRaw.creationHeight} — skipping price-dependent fee calculations for box ${currRaw.boxId}`
    );
    const category: FeeCategory = isFission
      ? "fission"
      : isFusion
      ? "fusion"
      : isTransmuteNP
      ? "transmuteNeutronToProton"
      : isTransmutePN
      ? "transmuteProtonToNeutron"
      : "unknown";

    return {
      ...base,
      category,
      devFeeErg,
      dilutionValueErg: 0,
      oracleFeeErg: 0,
      totalFeeErg: devFeeErg,
      isEstimate: false,
      priceUnavailable: true,
    };
  }

  const pegOracle = makePegOracleLike(goldPriceAtPrevHeight);

  if (isFission) {
    // FISSION — box.value increases by exactly the ERG fissioned. Neither
    // token amount held in the box can increase during fission (both flow
    // OUT to the user). Δvalue is the primary signal here — this box can
    // only be mutated through the contract's own valid state transitions, so
    // on a very small fission BOTH token deltas can legitimately round to
    // exactly 0 (nanoERG has far more precision than the token unit) while
    // still being a real fission. We don't require either side to move.
    const ergToFission = BigInt(Math.trunc(dValue));
    const sNeutrons = await prevGluonBox.getNeutronsCirculatingSupply();
    const sProtons = await prevGluonBox.getProtonsCirculatingSupply();
    const ergFissioned = BigInt(Math.trunc(prevGluonBox.getErgFissioned()));
    const fullNeutrons = (ergToFission * sNeutrons) / ergFissioned;
    const fullProtons = (ergToFission * sProtons) / ergFissioned;
    const actualNeutrons = BigInt(Math.trunc(-dNeutron));
    const actualProtons = BigInt(Math.trunc(-dProton));
    const dilutedNeutrons = fullNeutrons > actualNeutrons ? fullNeutrons - actualNeutrons : BigInt(0);
    const dilutedProtons = fullProtons > actualProtons ? fullProtons - actualProtons : BigInt(0);

    const neutronPrice = await prevGluonBox.neutronPrice(pegOracle);
    const protonPrice = await prevGluonBox.protonPrice(pegOracle);
    const dilutionNanoErg =
      Number((dilutedNeutrons * neutronPrice) / BigInt(1e9)) +
      Number((dilutedProtons * protonPrice) / BigInt(1e9));

    return {
      ...base,
      category: "fission",
      devFeeErg,
      dilutionValueErg: dilutionNanoErg / 1e9,
      oracleFeeErg: 0,
      totalFeeErg: devFeeErg + dilutionNanoErg / 1e9,
      isEstimate: false,
      priceUnavailable: false,
    };
  }

  if (isFusion) {
    // FUSION — box.value decreases by exactly the ERG redeemed. Same
    // reasoning as fission, mirrored: neither side can decrease during
    // fusion, and both sides can legitimately round to exactly 0 on a very
    // small fusion without it being any less real.
    const ergToRedeem = BigInt(Math.trunc(-dValue));
    const sNeutrons = await prevGluonBox.getNeutronsCirculatingSupply();
    const sProtons = await prevGluonBox.getProtonsCirculatingSupply();
    const ergFissioned = BigInt(Math.trunc(prevGluonBox.getErgFissioned()));
    const fullNeutrons = (ergToRedeem * sNeutrons) / ergFissioned;
    const fullProtons = (ergToRedeem * sProtons) / ergFissioned;
    const actualNeutronsIn = BigInt(Math.trunc(dNeutron));
    const actualProtonsIn = BigInt(Math.trunc(dProton));
    const dilutedNeutrons = actualNeutronsIn > fullNeutrons ? actualNeutronsIn - fullNeutrons : BigInt(0);
    const dilutedProtons = actualProtonsIn > fullProtons ? actualProtonsIn - fullProtons : BigInt(0);

    const neutronPrice = await prevGluonBox.neutronPrice(pegOracle);
    const protonPrice = await prevGluonBox.protonPrice(pegOracle);
    const dilutionNanoErg =
      Number((dilutedNeutrons * neutronPrice) / BigInt(1e9)) +
      Number((dilutedProtons * protonPrice) / BigInt(1e9));

    return {
      ...base,
      category: "fusion",
      devFeeErg,
      dilutionValueErg: dilutionNanoErg / 1e9,
      oracleFeeErg: 0,
      totalFeeErg: devFeeErg + dilutionNanoErg / 1e9,
      isEstimate: false,
      priceUnavailable: false,
    };
  }

  if (isTransmuteNP) {
    // TRANSMUTATION: neutron -> proton (user sends neutrons in, gets protons out).
    // dProton is allowed to be exactly 0 on a dust-sized decay where the
    // output proton amount rounds down to nothing.
    const neutronPrice = await prevGluonBox.neutronPrice(pegOracle);
    const transmutedVolNanoErg = (neutronPrice * BigInt(Math.trunc(dNeutron))) / BigInt(1e9);
    const volPlus = await prevGluonBox.getVolumeProtonsToNeutronsArray();
    const volMinus = await prevGluonBox.getVolumeNeutronsToProtonsArray();
    const ergFissioned = BigInt(Math.trunc(prevGluonBox.getErgFissioned()));
    const phiBetaScaled: bigint = prevGluonBox.varPhiBeta(ergFissioned, volPlus, volMinus);
    const dilutionNanoErg = Number((transmutedVolNanoErg * phiBetaScaled) / BigInt(1e9));
    const feeAmounts = await gluon.getTotalFeeAmountTransmuteToProton(prevGluonBox, pegOracle, Math.trunc(dNeutron));

    return {
      ...base,
      category: "transmuteNeutronToProton",
      devFeeErg,
      dilutionValueErg: dilutionNanoErg / 1e9,
      oracleFeeErg: feeAmounts.oracleFee / 1e9,
      totalFeeErg: devFeeErg + dilutionNanoErg / 1e9,
      isEstimate: true,
      priceUnavailable: false,
    };
  }

  if (isTransmutePN) {
    // TRANSMUTATION: proton -> neutron (user sends protons in, gets neutrons out).
    // dNeutron is allowed to be exactly 0 for the same dust-rounding reason.
    const protonPrice = await prevGluonBox.protonPrice(pegOracle);
    const transmutedVolNanoErg = (protonPrice * BigInt(Math.trunc(dProton))) / BigInt(1e9);
    const volPlus = await prevGluonBox.getVolumeProtonsToNeutronsArray();
    const volMinus = await prevGluonBox.getVolumeNeutronsToProtonsArray();
    const ergFissioned = BigInt(Math.trunc(prevGluonBox.getErgFissioned()));
    const phiBetaScaled: bigint = prevGluonBox.varPhiBeta(ergFissioned, volPlus, volMinus);
    const dilutionNanoErg = Number((transmutedVolNanoErg * phiBetaScaled) / BigInt(1e9));
    const feeAmounts = await gluon.getTotalFeeAmountTransmuteToNeutron(prevGluonBox, pegOracle, Math.trunc(dProton));

    return {
      ...base,
      category: "transmuteProtonToNeutron",
      devFeeErg,
      dilutionValueErg: dilutionNanoErg / 1e9,
      oracleFeeErg: feeAmounts.oracleFee / 1e9,
      totalFeeErg: devFeeErg + dilutionNanoErg / 1e9,
      isEstimate: true,
      priceUnavailable: false,
    };
  }

  // Deltas don't match any known pattern (e.g. both tokens moved the same
  // direction, or value moved without a matching token pattern). Surface it
  // rather than silently dropping the fee data.
  warnDebug("[FeeBreakdown] Unclassified transition", {
    boxId: currRaw.boxId,
    txId: prevRaw.spentTransactionId,
    explorerUrl: prevRaw.spentTransactionId
      ? `https://explorer.ergoplatform.com/en/transactions/${prevRaw.spentTransactionId}`
      : null,
    dValue,
    dNeutron,
    dProton,
  });
  return {
    ...base,
    category: "unknown",
    devFeeErg,
    dilutionValueErg: 0,
    oracleFeeErg: 0,
    totalFeeErg: devFeeErg,
    isEstimate: false,
    priceUnavailable: false,
  };
}

interface ChainResult {
  ordered: ExplorerBox[];
  brokenLinks: number;
}

/**
 * Reorders boxes by their TRUE spend chain (A.spentTransactionId === B.transactionId),
 * rather than trusting the array order Explorer's byTokenId endpoint returns.
 *
 * WHY THIS MATTERS: Ergo routinely mines multiple chained transactions for the
 * same box lineage into a single block, so many box versions can legitimately
 * share one creationHeight. Sorting by height alone doesn't guarantee same-height
 * boxes come back in true spend order — and diffing two boxes that AREN'T
 * actually chain-adjacent produces incoherent, multi-directional deltas that
 * don't match any real economic action (which is exactly what showed up as
 * "unknown" transitions clustered at heights like 1633902, 1663942, 1699918 —
 * all heights with many box versions in one block).
 */
function reconstructTrueChainOrder(boxes: ExplorerBox[]): ChainResult {
  const byCreatingTx = new Map<string, ExplorerBox>();
  for (const b of boxes) {
    if (b.transactionId) byCreatingTx.set(b.transactionId, b);
  }

  // Genesis = the box whose creating tx isn't any other box's spentTransactionId
  // (i.e. nothing in our set claims to have been spent to create it).
  const spentTxIds = new Set(boxes.map((b) => b.spentTransactionId).filter(Boolean));
  const candidates = boxes.filter((b) => !spentTxIds.has(b.transactionId));
  // There should be exactly one true genesis; if height-sort agrees, prefer the lowest height.
  candidates.sort((a, b) => a.creationHeight - b.creationHeight);
  let current: ExplorerBox | undefined = candidates[0];

  const ordered: ExplorerBox[] = [];
  const visited = new Set<string>();
  let brokenLinks = 0;

  while (current && !visited.has(current.boxId)) {
    ordered.push(current);
    visited.add(current.boxId);
    if (!current.spentTransactionId) break; // current tip of the chain (still unspent)
    const next = byCreatingTx.get(current.spentTransactionId);
    if (!next) {
      // Chain breaks here — the box that should exist (created by
      // current.spentTransactionId) wasn't in our fetched set at all. This is a
      // real gap (missed by pagination, or genuinely not indexed), not a
      // reordering issue — log it loudly rather than silently truncating.
      warnDebug("[FeeBreakdown] Chain break — missing successor box", {
        afterBoxId: current.boxId,
        expectedCreatingTx: current.spentTransactionId,
      });
      brokenLinks++;
      break;
    }
    current = next;
  }

  if (ordered.length !== boxes.length) {
    warnDebug(
      `[FeeBreakdown] Chain reconstruction only recovered ${ordered.length}/${boxes.length} boxes — ` +
        `falling back to height-sort for any unreachable boxes so no data is silently dropped.`
    );
    const orderedIds = new Set(ordered.map((b) => b.boxId));
    const leftover = boxes.filter((b) => !orderedIds.has(b.boxId)).sort((a, b) => a.creationHeight - b.creationHeight);
    ordered.push(...leftover);
  }

  return { ordered, brokenLinks };
}

export function useGluonFeeBreakdown(): UseGluonFeeBreakdownResult {
  const [points, setPoints] = useState<CumulativeFeePoint[]>([]);
  const [transitions, setTransitions] = useState<TransitionFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const cached = readCache();
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        if (!cancelled) {
          setPoints(cached.points);
          setTransitions(cached.transitions);
          setNotes(cached.notes);
          setLoading(false);
        }
        return;
      }

      try {
        const sdkMod = await import("gluon-ergo-sdk");
        const gluon = new sdkMod.Gluon();
        gluon.config.NETWORK = process.env.NEXT_PUBLIC_DEPLOYMENT || "testnet";
        gluon.config.NODE_URL = process.env.NEXT_PUBLIC_NODE_URL || "https://node.ergopool.io/";
        const GLUON_NFT_ID = sdkMod.GLUON_NFT;

        const [allBoxes, headersRes, oracleHistory] = await Promise.all([
          fetchAllBoxesByToken(GLUON_NFT_ID),
          fetch(`${EXPLORER_BASE}/blocks/headers?limit=1`),
          fetchOracleHistory().catch(() => [] as OraclePoint[]),
        ]);

        if (!headersRes.ok) throw new Error(`Explorer headers fetch failed: ${headersRes.status}`);
        const headersData = await headersRes.json();
        const currentHeight: number = headersData.items[0].height;
        const currentTimestamp: number = headersData.items[0].timestamp;

        const validBoxesUnordered = allBoxes.filter((b) => {
          if (b.value === 0) return false;
          const hasNeutron = b.assets.some((a) => a.tokenId === NEUTRON_ID);
          const hasProton = b.assets.some((a) => a.tokenId === PROTON_ID);
          return hasNeutron && hasProton;
        });

        const { ordered: validBoxes, brokenLinks } = reconstructTrueChainOrder(validBoxesUnordered);

        const newTransitions: TransitionFee[] = [];
        let skippedMigration = 0;
        let skippedMissingRegisters = 0;
        let unclassified = 0;
        let priceUnavailableCount = 0;

        let chainLinkMismatches = 0;
        for (let i = 1; i < validBoxes.length; i++) {
          if (cancelled) break;
          const prevRaw = validBoxes[i - 1];
          const currRaw = validBoxes[i];

          if (prevRaw.spentTransactionId !== currRaw.transactionId) {
            // Should be rare/zero now that we follow true chain order — but if
            // it happens (e.g. a leftover box appended by the fallback path),
            // flag it rather than silently diffing two non-adjacent boxes.
            chainLinkMismatches++;
            warnDebug("[FeeBreakdown] Chain link mismatch — diffing non-adjacent boxes", {
              prevBoxId: prevRaw.boxId,
              prevSpentTx: prevRaw.spentTransactionId,
              currBoxId: currRaw.boxId,
              currCreatingTx: currRaw.transactionId,
            });
            continue;
          }

          const timestamp = currentTimestamp - (currentHeight - currRaw.creationHeight) * BLOCK_TIME_MS;
          const goldPriceAtPrev = findNearestOraclePrice(oracleHistory, prevRaw.creationHeight);

          if (prevRaw.address !== currRaw.address) {
            skippedMigration++;
            continue;
          }
          if (!hasAllRequiredRegisters(prevRaw) || !hasAllRequiredRegisters(currRaw)) {
            skippedMissingRegisters++;
            continue;
          }

          const fee = await computeTransitionFee(sdkMod, gluon, prevRaw, currRaw, goldPriceAtPrev, timestamp);
          if (fee) {
            if (fee.category === "unknown") unclassified++;
            if (fee.priceUnavailable) priceUnavailableCount++;
            newTransitions.push(fee);
          }
        }

        // Build cumulative series
        const newPoints: CumulativeFeePoint[] = [];
        let cFission = 0;
        let cFusion = 0;
        let cTransmuteNP = 0;
        let cTransmutePN = 0;
        let cOracle = 0;
        let cUnknown = 0;
        let cEstimatedNP = 0;
        let cEstimatedPN = 0;
        for (const t of newTransitions) {
          if (t.category === "fission") {
            cFission += t.totalFeeErg;
          } else if (t.category === "fusion") {
            cFusion += t.totalFeeErg;
          } else if (t.category === "transmuteNeutronToProton") {
            cTransmuteNP += t.totalFeeErg;
            cEstimatedNP += t.dilutionValueErg;
          } else if (t.category === "transmuteProtonToNeutron") {
            cTransmutePN += t.totalFeeErg;
            cEstimatedPN += t.dilutionValueErg;
          } else if (t.category === "unknown") {
            cUnknown += t.devFeeErg;
          }
          cOracle += t.oracleFeeErg;
          newPoints.push({
            height: t.height,
            timestamp: t.timestamp,
            fission: cFission,
            fusion: cFusion,
            transmuteNeutronToProton: cTransmuteNP,
            transmuteProtonToNeutron: cTransmutePN,
            oracle: cOracle,
            estimatedNeutronToProton: cEstimatedNP,
            estimatedProtonToNeutron: cEstimatedPN,
            betaDecay: cTransmuteNP + cTransmutePN,
            estimated: cEstimatedNP + cEstimatedPN,
            total: cFission + cFusion + cTransmuteNP + cTransmutePN + cOracle + cUnknown,
          });
        }

        const diagnosticNotes = [
          `Total valid state boxes: ${validBoxes.length}`,
          `Transitions computed: ${newTransitions.length}`,
          `Chain reconstruction: broken links (missing successor box) = ${brokenLinks}`,
          `Chain link mismatches during diffing (should be ~0 now): ${chainLinkMismatches}`,
          `Skipped (contract migration boundary): ${skippedMigration}`,
          `Skipped (missing registers): ${skippedMissingRegisters}`,
          `Unclassified transitions (devFee only, no dilution): ${unclassified}`,
          `Transitions with unavailable oracle price (devFee only, price <= 0): ${priceUnavailableCount}`,
          "Transmutation dilution value is a rate-based estimate (varPhiBeta × transmuted volume), not an exact token-shortfall like Fission/Fusion.",
        ];

        const entry: CacheEntry = {
          fetchedAt: Date.now(),
          points: newPoints,
          transitions: newTransitions,
          notes: diagnosticNotes,
        };

        if (!cancelled) {
          writeCache(entry);
          setPoints(newPoints);
          setTransitions(newTransitions);
          setNotes(diagnosticNotes);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        console.error("[FeeBreakdown] Fetch failed:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { points, transitions, loading, error, notes };
}