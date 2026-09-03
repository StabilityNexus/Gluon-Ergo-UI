/**
 * @file useGluonTransactionHistory.ts
 * @description Fetches Gluon Gold protocol box history from the Ergo Explorer API.
 *
 * FIX (v4): Previous versions fetched only limit=100 boxes, which caused history
 * to stop at Aug 13, 2024. There are 667+ valid protocol state boxes. This version
 * paginates through ALL pages.
 *
 * FIX (v5): Added per-snapshot historical gold (oracle) price by fetching all
 * oracle pool boxes and matching each gluon snapshot to the nearest oracle box
 * by block height. Without this, the ReserveRatio chart was applying today's
 * gold price to every historical point, making early (pre-depeg) history show
 * an incorrectly low reserve ratio.
 *
 * TIMESTAMP NOTE: Block timestamps are approximated as:
 *   approxTimestamp = latestBlockTimestamp - (latestHeight - boxHeight) × 120_000 ms
 * The Ergo Explorer v1 box endpoint does not return per-box timestamps; 120 seconds
 * per block is the network target. Actual timestamps may drift ±30 s per block
 * over long ranges (e.g. ±hours over 12 months). This is documented on all charts.
 *
 * SECONDARY FINDING: A contract address upgrade happened at height ~1397584
 * (Nov 22, 2024). The NFT lineage (797e331d...) is continuous; the address changed
 * from E81MR2gGkYE1vDkdcGYns4wYehfJLdX6hpwHMGrh to
 * U2Jtp6oeBTnbGS7ed2PvkudukZYRBBSfi557aCmz. This is marked in snapshots.
 */

import { useEffect, useState } from "react";


export interface GluonBoxSnapshot {
  height: number;
  timestamp: number;       // unix ms (approximate — see TIMESTAMP NOTE above)
  ergValue: number;        // in ERG (not nanoERG)
  neutronAmount: number;   // raw token units
  protonAmount: number;    // raw token units
  feePaidErg: number;      // ERG difference from previous box (0 if first or negative)
  /**
   * Historical gold oracle price in nanoERG per kg at the time of this snapshot.
   * Matched from the nearest oracle box by block height. Falls back to 0 if
   * oracle history is unavailable (charts will show "loading" instead of wrong data).
   */
  goldPriceNanoErg: number;
  spentTxId: string | null;
  source: "pre-migration" | "post-migration";
  migrationBoundary: boolean;
}

export interface UseGluonTransactionHistoryResult {
  snapshots: GluonBoxSnapshot[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  migrationHeights: number[];
  notes: string[];
}

interface ExplorerAsset {
  tokenId: string;
  amount: number;
}

/**
 * Register value as returned by the Ergo Explorer v1 API.
 * The Explorer pre-decodes the value — we read `renderedValue` directly
 * instead of rolling our own ZigZag-VLQ decoder over `serializedValue`.
 */
interface ExplorerRegisterValue {
  serializedValue: string;
  sigmaType: string;
  /** Already-decoded string representation of the register value. */
  renderedValue: string;
}

interface ExplorerBox {
  boxId: string;
  transactionId: string;
  blockId: string;
  creationHeight: number;
  value: number; // nanoErgs
  assets: ExplorerAsset[];
  address: string;
  /**
   * Register map from the Explorer API. Each value is an object with
   * serializedValue / sigmaType / renderedValue — NOT a raw string.
   */
  additionalRegisters: Record<string, ExplorerRegisterValue>;
  spentTransactionId: string | null;
}

// Bump cache key to v9 — v9 samples oracle prices across entire lifespan (genesis -> today)
const CACHE_KEY = "gluon_box_history_v9";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const EXPLORER_BASE = "https://api.ergoplatform.com/api/v1";
const BLOCK_TIME_MS = 120_000; // 2 minutes per block (Ergo target; actual drift ≈ ±30 s/block)
const PAGE_SIZE = 100; // Max allowed by Explorer API

const NEUTRON_ID = "886b7721bef42f60c6317d37d8752da8aca01898cae7dae61808c4a14225edc8";
const PROTON_ID  = "9944ff273ff169f32b851b96bbecdbb67f223101c15ae143de82b3e7f75b19d2";

// Gold oracle pool NFT — identifies oracle boxes carrying the gold price in R4.
// Source: gluon-ergo-sdk/dist/consts.js → ORACLE_POOL_NFT
const ORACLE_POOL_NFT = "3c45f29a5165b030fdb5eaf5d81f8108f9d8f507b31487dd51f4ae08fe07cf4a";

// Known contract upgrade: address changed at ~height 1397584 (Nov 22, 2024)
// Old: E81MR2gGkYE1vDkdcGYns4wYehfJLdX6hpwHMGrh
// New: U2Jtp6oeBTnbGS7ed2PvkudukZYRBBSfi557aCmz
const OLD_CONTRACT_ADDRESS = "E81MR2gGkYE1vDkdcGYns4wYehfJLdX6hpwHMGrh";
const NEW_CONTRACT_ADDRESS = "U2Jtp6oeBTnbGS7ed2PvkudukZYRBBSfi557aCmz";

interface OraclePoint {
  height: number;
  /** Gold price in nanoERG per kg (raw R4 value). Divide by 1000 for per-gram. */
  goldPriceNanoErg: number;
}

interface CacheEntry {
  fetchedAt: number;
  snapshots: GluonBoxSnapshot[];
  totalCount: number;
  migrationHeights: number[];
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

/**
 * Fetches ALL pages of boxes carrying the given token (NFT or token ID).
 * The Explorer API allows max 100 per page; paginates until done.
 * Safety limit: 10 000 boxes.
 */
async function fetchAllBoxesByToken(tokenId: string): Promise<ExplorerBox[]> {
  const all: ExplorerBox[] = [];
  let offset = 0;
  let pageNum = 0;

  while (true) {
    const url = `${EXPLORER_BASE}/boxes/byTokenId/${tokenId}?limit=${PAGE_SIZE}&offset=${offset}&sortDirection=asc`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Explorer boxes fetch failed: ${res.status} at offset ${offset} (token=${tokenId.slice(0, 8)}...)`);

    const data = await res.json();
    const items: ExplorerBox[] = data.items || [];
    all.push(...items);
    pageNum++;

    console.log(`[GluonHistory] Page ${pageNum}: token=${tokenId.slice(0, 8)}... offset=${offset} got=${items.length} cumulative=${all.length}`);

    if (items.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;

    // Safety: stop at 10 000 boxes to prevent runaway loops
    if (all.length >= 10000) {
      console.warn("[GluonHistory] Safety limit reached at 10000 boxes");
      break;
    }
  }

  return all;
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
    console.log(`[GluonHistory] Fetching spanning oracle price history (NFT: ${ORACLE_POOL_NFT.slice(0, 8)}...)`);
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

    console.log(`[GluonHistory] Spanning oracle price points extracted: ${deduped.length}`);
    if (deduped.length > 0) {
      console.log(
        `[GluonHistory] Oracle price range: ${(deduped[0].goldPriceNanoErg / 1e9).toFixed(1)} ERG/kg (height ${deduped[0].height}) → ${(deduped[deduped.length - 1].goldPriceNanoErg / 1e9).toFixed(1)} ERG/kg (height ${deduped[deduped.length - 1].height})`
      );
    }
    return deduped;
  } catch (err) {
    console.warn("[GluonHistory] Oracle history fetch failed:", err);
    return [];
  }
}

/**
 * Binary-search nearest oracle price point for a given block height.
 * Falls back to 0 if oracleHistory is empty.
 */
function findNearestOraclePrice(oracleHistory: OraclePoint[], height: number): number {
  if (!oracleHistory || oracleHistory.length === 0) return 0;
  let lo = 0;
  let hi = oracleHistory.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (oracleHistory[mid].height < height) lo = mid + 1;
    else hi = mid;
  }
  // lo is now the first point with height >= target; compare with lo-1
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

export function useGluonTransactionHistory(): UseGluonTransactionHistoryResult {
  const [snapshots, setSnapshots] = useState<GluonBoxSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [migrationHeights, setMigrationHeights] = useState<number[]>([]);
  const [notes, setNotes] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Try cache first
      const cached = readCache();
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        if (!cancelled) {
          setSnapshots(cached.snapshots);
          setTotalCount(cached.totalCount);
          setMigrationHeights(cached.migrationHeights);
          setNotes(cached.notes);
          setLoading(false);
        }
        return;
      }

      // Show stale data while fetching fresh
      if (cached) {
        if (!cancelled) {
          setSnapshots(cached.snapshots);
          setTotalCount(cached.totalCount);
          setMigrationHeights(cached.migrationHeights || []);
          setNotes(cached.notes || []);
        }
      }

      try {
        console.log("[GluonHistory] Starting full paginated history fetch (v5 — with oracle prices)...");

        const sdk = await import("gluon-ergo-sdk");
        const GLUON_NFT_ID = sdk.GLUON_NFT;

        // Fetch gluon boxes, oracle boxes, and current block header in parallel.
        // Oracle history fetch is best-effort: if it fails we fall back to goldPriceNanoErg = 0
        // and the chart will display a "no oracle data" note rather than wrong values.
        const [allBoxes, headersRes, oracleHistory] = await Promise.all([
          fetchAllBoxesByToken(GLUON_NFT_ID),
          fetch(`${EXPLORER_BASE}/blocks/headers?limit=1`),
          fetchOracleHistory().catch((e) => {
            console.warn("[GluonHistory] Oracle history fetch failed (non-fatal):", e);
            return [] as OraclePoint[];
          }),
        ]);

        if (!headersRes.ok) throw new Error(`Explorer headers fetch failed: ${headersRes.status}`);

        const headersData = await headersRes.json();
        const currentHeight: number = headersData.items[0].height;
        const currentTimestamp: number = headersData.items[0].timestamp;

        console.log(`[GluonHistory] Total boxes from NFT lineage: ${allBoxes.length}`);
        console.log(`[GluonHistory] Oracle price points: ${oracleHistory.length}`);

        // Filter to valid protocol state boxes (must carry both neutron and proton)
        const validBoxes = allBoxes.filter(b => {
          if (b.value === 0) return false;
          const hasNeutron = b.assets.some(a => a.tokenId === NEUTRON_ID);
          const hasProton = b.assets.some(a => a.tokenId === PROTON_ID);
          return hasNeutron && hasProton;
        });

        console.log(`[GluonHistory] Valid state boxes (has neutron+proton): ${validBoxes.length}`);

        // Detect migration: track when contract address changes
        const detectedMigrationHeights: number[] = [];
        const migrationNotes: string[] = [];
        let prevAddress: string | null = null;
        let inMigration = false;

        // Pre-scan to detect address transitions
        for (const b of validBoxes) {
          const addr = b.address;
          if (prevAddress && addr !== prevAddress && !inMigration) {
            detectedMigrationHeights.push(b.creationHeight);
            migrationNotes.push(
              `Contract address changed at height ${b.creationHeight}: ${prevAddress.slice(0, 16)}... → ${addr.slice(0, 16)}...`
            );
            inMigration = true;
          }
          if (addr === NEW_CONTRACT_ADDRESS && prevAddress === OLD_CONTRACT_ADDRESS) {
            inMigration = false; // Reset after we've logged it
          }
          prevAddress = addr;
        }

        if (detectedMigrationHeights.length === 0) {
          migrationNotes.push("No contract address change detected in fetched boxes.");
        }

        console.log("[GluonHistory] Migration heights detected:", detectedMigrationHeights);

        // Build snapshots
        const newSnapshots: GluonBoxSnapshot[] = [];
        const migrationHeightSet = new Set(detectedMigrationHeights);

        for (let i = 0; i < validBoxes.length; i++) {
          const b = validBoxes[i];
          const prev = i > 0 ? validBoxes[i - 1] : null;

          const nAsset = b.assets.find(a => a.tokenId === NEUTRON_ID);
          const pAsset = b.assets.find(a => a.tokenId === PROTON_ID);

          const ergValue = b.value / 1e9;
          const prevErg = prev ? prev.value / 1e9 : 0;
          const feePaidErg = prev ? Math.max(0, +(ergValue - prevErg).toFixed(6)) : 0;

          // Timestamp approximation: Ergo target is 120 s/block. Actual drift is
          // typically ±30 s/block; over 12 months this can accumulate to ±hours.
          // The Ergo Explorer v1 box API does not expose per-box timestamps.
          const approxTimestamp =
            currentTimestamp - (currentHeight - b.creationHeight) * BLOCK_TIME_MS;

          // Historical gold price from nearest oracle box by height.
          // If oracleHistory is empty (fetch failed), goldPriceNanoErg = 0 so
          // charts can detect the missing data and display a note instead of wrong ratios.
          const goldPriceNanoErg = findNearestOraclePrice(oracleHistory, b.creationHeight);

          // Determine source: pre or post migration
          const source: "pre-migration" | "post-migration" =
            detectedMigrationHeights.length > 0 &&
            b.creationHeight >= detectedMigrationHeights[0]
              ? "post-migration"
              : "pre-migration";

          newSnapshots.push({
            height: b.creationHeight,
            timestamp: approxTimestamp,
            ergValue,
            neutronAmount: nAsset ? nAsset.amount : 0,
            protonAmount: pAsset ? pAsset.amount : 0,
            feePaidErg,
            goldPriceNanoErg,
            spentTxId: b.spentTransactionId,
            source,
            migrationBoundary: migrationHeightSet.has(b.creationHeight),
          });
        }

        const total = validBoxes.length;
        const lastSnapshot = newSnapshots[newSnapshots.length - 1];
        if (lastSnapshot && lastSnapshot.height < currentHeight) {
          const currentGoldPrice = oracleHistory[oracleHistory.length - 1]?.goldPriceNanoErg || 0;
          newSnapshots.push({
            height: currentHeight,
            timestamp: currentTimestamp,
            ergValue: lastSnapshot.ergValue,
            neutronAmount: lastSnapshot.neutronAmount,
            protonAmount: lastSnapshot.protonAmount,
            feePaidErg: 0,
            goldPriceNanoErg: currentGoldPrice,
            spentTxId: null,
            source: lastSnapshot.source,
            migrationBoundary: false,
          });
        }

        const firstSnapshot = newSnapshots[0];
        const postMigCount = newSnapshots.filter(s => s.source === "post-migration").length;
        const hasOracleData = oracleHistory.length > 0;

        console.log("[GluonHistory] old lineage snapshots:", newSnapshots.filter(s => s.source === "pre-migration").length);
        console.log("[GluonHistory] post-migration snapshots:", postMigCount);
        console.log("[GluonHistory] migration heights:", detectedMigrationHeights);
        console.log("[GluonHistory] merged snapshots total:", newSnapshots.length);
        if (lastSnapshot) {
          console.log("[GluonHistory] last snapshot date:", new Date(lastSnapshot.timestamp).toISOString());
        }
        if (firstSnapshot) {
          console.log("[GluonHistory] first snapshot date:", new Date(firstSnapshot.timestamp).toISOString());
        }

        const diagnosticNotes = [
          `Total valid boxes fetched: ${total}`,
          `Pre-migration: ${newSnapshots.filter(s => s.source === "pre-migration").length} boxes`,
          `Post-migration: ${postMigCount} boxes`,
          firstSnapshot
            ? `First box: ${new Date(firstSnapshot.timestamp).toISOString().split("T")[0]}`
            : "No first box",
          lastSnapshot
            ? `Last box: ${new Date(lastSnapshot.timestamp).toISOString().split("T")[0]}`
            : "No last box",
          hasOracleData
            ? `Oracle price history: ${oracleHistory.length} points (height ${oracleHistory[0]?.height}–${oracleHistory[oracleHistory.length - 1]?.height})`
            : "Oracle history unavailable — reserve ratio chart may use fallback gold price",
          ...migrationNotes,
        ];

        const entry: CacheEntry = {
          fetchedAt: Date.now(),
          snapshots: newSnapshots,
          totalCount: total,
          migrationHeights: detectedMigrationHeights,
          notes: diagnosticNotes,
        };

        if (!cancelled) {
          writeCache(entry);
          setSnapshots(newSnapshots);
          setTotalCount(total);
          setMigrationHeights(detectedMigrationHeights);
          setNotes(diagnosticNotes);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        console.error("[GluonHistory] Fetch failed:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { snapshots, loading, error, totalCount, migrationHeights, notes };
}
