/**
 * @file fakeClient.ts
 * @description Fake GluonClient implementation recording calls and supplying controllable snapshots.
 * @module test
 */
import type { ChainState, ProtocolSnapshot, ActionQuote, AdjustPegQuote, ReactorState } from "@stability-nexus/gluon-ergo-sdk";

export type SnapshotMode = "healthy" | "below-range" | "above-range";

export interface FakeUnsignedTx {
  toBytes(): Uint8Array;
}

export function createFakeReactorState(overrides: Partial<ReactorState> = {}): ReactorState {
  return {
    value: 1000000000000n,
    neutrons: 500000000000n,
    protons: 500000000000n,
    totalNeutrons: 1000000000000n,
    totalProtons: 1000000000000n,
    treasury: "9f4QF8AD1nQ3nJahQVkMj8hFSVVzVom77b52JU7EW71Zexg6N8v",
    devFeeRepaid: 100000000n,
    maxDevFee: 500000000n,
    volumePlus: [10000000n, 20000000n, 30000000n, 40000000n],
    volumeMinus: [10000000n, 20000000n, 30000000n, 40000000n],
    lastBucketBlock: 1200000n,
    pegFactor: 1000000n,
    ...overrides,
  };
}

export function createFakeChainState(overrides: Partial<ChainState> = {}): ChainState {
  return {
    height: 1250000,
    reactor: {
      boxId: "1".repeat(64),
      value: 1000000000000n,
      ergoTree: "0008cd",
      assets: [],
      creationHeight: 1200000,
      additionalRegisters: {},
      transactionId: "2".repeat(64),
      index: 0,
    },
    oracle: {
      boxId: "3".repeat(64),
      value: 1000000000n,
      ergoTree: "0008cd",
      assets: [],
      creationHeight: 1249995,
      additionalRegisters: { R4: "0580897a" },
      transactionId: "4".repeat(64),
      index: 0,
    },
    buyback: {
      boxId: "5".repeat(64),
      value: 500000000n,
      ergoTree: "0008cd",
      assets: [],
      creationHeight: 1249990,
      additionalRegisters: {},
      transactionId: "6".repeat(64),
      index: 0,
    },
    state: createFakeReactorState(),
    ...overrides,
  };
}

export function createFakeSnapshot(mode: SnapshotMode = "healthy"): ProtocolSnapshot {
  const base: ProtocolSnapshot = {
    deployment: "gluon-gold-v3",
    height: 1250000,
    reserve: 1000000000000n,
    neutronsInCirculation: 500000000000n,
    protonsInCirculation: 500000000000n,
    oraclePrice: 1500000000n,
    oracleAge: 5,
    pegFactor: 1000000n,
    initialPegFactor: 1000000n,
    pegDrift: 1.0,
    pegUnitPrice: 1500000000n,
    targetPrice: 1500000000n,
    q: 700000000n,
    qNorm: 700000000n,
    healthy: true,
    adjustPeg: undefined,
    neutronPrice: 1500000000n,
    protonPrice: 500000000n,
    reserveRatio: 1.45,
    protonLeverage: 2.1,
    crashCushion: {
      untilDepeg: 0.35,
      untilAdjustment: 0.15,
    },
    volumes: {
      plus: [10000000n, 20000000n, 30000000n, 40000000n],
      minus: [10000000n, 20000000n, 30000000n, 40000000n],
    },
    devFee: {
      repaid: 100000000n,
      max: 500000000n,
    },
    treasuryAddress: "9f4QF8AD1nQ3nJahQVkMj8hFSVVzVom77b52JU7EW71Zexg6N8v",
    betaDecaysAvailable: true,
  };

  if (mode === "below-range") {
    return {
      ...base,
      healthy: false,
      reserveRatio: 0.45,
      q: 450000000n,
      qNorm: 450000000n,
      adjustPeg: {
        direction: "up",
        steps: 3,
      },
      betaDecaysAvailable: false,
      oracleAge: 8,
    };
  }

  if (mode === "above-range") {
    return {
      ...base,
      healthy: false,
      reserveRatio: 2.15,
      q: 990000000n,
      qNorm: 990000000n,
      adjustPeg: {
        direction: "down",
        steps: 2,
      },
      betaDecaysAvailable: false,
      oracleAge: 12,
    };
  }

  return base;
}

export function createFakeQuote(): ActionQuote {
  return {
    ergIn: 1000000000n,
    ergOut: 0n,
    neutronsIn: 0n,
    neutronsOut: 500000000n,
    protonsIn: 0n,
    protonsOut: 500000000n,
    principal: 980000000n,
    fees: {
      dev: 10000000n,
      ui: 0n,
      oracle: 5000000n,
      outputsMinFee: 2000000n,
      miner: 1000000n,
      total: 18000000n,
    },
    next: createFakeReactorState(),
    qAfter: 720000000n,
  };
}

export class FakeGluonClient {
  public mode: SnapshotMode = "healthy";
  public calls: Array<{ method: string; args: unknown[] }> = [];

  constructor(initialMode: SnapshotMode = "healthy") {
    this.mode = initialMode;
  }

  setMode(mode: SnapshotMode) {
    this.mode = mode;
  }

  async fetchChainState(): Promise<ChainState> {
    this.calls.push({ method: "fetchChainState", args: [] });
    return createFakeChainState();
  }

  async snapshot(_chain?: ChainState): Promise<ProtocolSnapshot> {
    this.calls.push({ method: "snapshot", args: [_chain] });
    return createFakeSnapshot(this.mode);
  }

  async quoteFission(...args: unknown[]): Promise<ActionQuote> {
    this.calls.push({ method: "quoteFission", args });
    return createFakeQuote();
  }

  async quoteFusion(...args: unknown[]): Promise<ActionQuote> {
    this.calls.push({ method: "quoteFusion", args });
    return createFakeQuote();
  }

  async quoteBetaDecayPlus(...args: unknown[]): Promise<ActionQuote> {
    this.calls.push({ method: "quoteBetaDecayPlus", args });
    return createFakeQuote();
  }

  async quoteBetaDecayMinus(...args: unknown[]): Promise<ActionQuote> {
    this.calls.push({ method: "quoteBetaDecayMinus", args });
    return createFakeQuote();
  }

  async quoteAdjustPeg(...args: unknown[]): Promise<AdjustPegQuote> {
    this.calls.push({ method: "quoteAdjustPeg", args });
    const snap = createFakeSnapshot(this.mode);
    return {
      allowed: !snap.healthy,
      direction: snap.adjustPeg?.direction,
      steps: snap.adjustPeg?.steps || 0,
      nextPegFactor: 990000n,
    };
  }

  async buildFission(...args: unknown[]): Promise<FakeUnsignedTx> {
    this.calls.push({ method: "buildFission", args });
    return { toBytes: () => new Uint8Array([1, 2, 3]) };
  }

  async buildFusion(...args: unknown[]): Promise<FakeUnsignedTx> {
    this.calls.push({ method: "buildFusion", args });
    return { toBytes: () => new Uint8Array([1, 2, 3]) };
  }

  async buildBetaDecayPlus(...args: unknown[]): Promise<FakeUnsignedTx> {
    this.calls.push({ method: "buildBetaDecayPlus", args });
    return { toBytes: () => new Uint8Array([1, 2, 3]) };
  }

  async buildBetaDecayMinus(...args: unknown[]): Promise<FakeUnsignedTx> {
    this.calls.push({ method: "buildBetaDecayMinus", args });
    return { toBytes: () => new Uint8Array([1, 2, 3]) };
  }

  async buildAdjustPeg(...args: unknown[]): Promise<FakeUnsignedTx> {
    this.calls.push({ method: "buildAdjustPeg", args });
    return { toBytes: () => new Uint8Array([1, 2, 3]) };
  }

  async buildUpdateTreasury(...args: unknown[]): Promise<FakeUnsignedTx> {
    this.calls.push({ method: "buildUpdateTreasury", args });
    return { toBytes: () => new Uint8Array([1, 2, 3]) };
  }

  async maxBetaDecayPlus(...args: unknown[]): Promise<bigint> {
    this.calls.push({ method: "maxBetaDecayPlus", args });
    return 10000000000n;
  }

  async maxBetaDecayMinus(...args: unknown[]): Promise<bigint> {
    this.calls.push({ method: "maxBetaDecayMinus", args });
    return 10000000000n;
  }

  async findMaxQuote(...args: unknown[]): Promise<ActionQuote> {
    this.calls.push({ method: "findMaxQuote", args });
    return createFakeQuote();
  }
}
