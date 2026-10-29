/**
 * @file fakeClient.ts
 * @description Fake GluonClient implementation recording calls, supplying controllable snapshots, and realistic quote math.
 * @module test
 */
import { GluonError, type ChainState, type ProtocolSnapshot, type ActionQuote, type AdjustPegQuote, type ReactorState } from "@stability-nexus/gluon-ergo-sdk";

export type SnapshotMode = "healthy" | "below-range" | "above-range" | "stale-oracle" | "no-buyback";
export type FakeClientMode = SnapshotMode;

export interface FakeEip12UnsignedTx {
  inputs: unknown[];
  dataInputs: unknown[];
  outputs: unknown[];
  toBytes(): Uint8Array;
}
export type FakeUnsignedTx = FakeEip12UnsignedTx;

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

  if (mode === "stale-oracle") {
    return {
      ...base,
      oracleAge: 40,
    };
  }

  if (mode === "no-buyback") {
    return {
      ...base,
      betaDecaysAvailable: false,
    };
  }

  return base;
}

export function createFakeQuote(overrides: Partial<ActionQuote> = {}): ActionQuote {
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
    ...overrides,
  };
}

export class FakeGluonClient {
  public mode: SnapshotMode = "healthy";
  public calls: Array<{ method: string; chain?: ChainState; args: unknown[] }> = [];

  constructor(initialMode: SnapshotMode = "healthy") {
    this.mode = initialMode;
  }

  setMode(mode: SnapshotMode) {
    this.mode = mode;
  }

  async fetchChainState(): Promise<ChainState> {
    this.calls.push({ method: "fetchChainState", args: [] });
    return createFakeChainState({
      buyback: this.mode === "no-buyback" ? undefined : createFakeChainState().buyback,
    });
  }

  snapshot(_chain?: ChainState): ProtocolSnapshot {
    this.calls.push({ method: "snapshot", chain: _chain, args: [_chain] });
    return createFakeSnapshot(this.mode);
  }

  quoteFission(_chain: ChainState, erg: bigint): ActionQuote {
    this.calls.push({ method: "quoteFission", chain: _chain, args: [erg] });
    if (this.mode === "stale-oracle" || (_chain?.oracle?.creationHeight && _chain.height + 1 - _chain.oracle.creationHeight >= 35)) {
      throw new GluonError("ORACLE_STALE", "the oracle price is too old");
    }
    if (this.mode === "below-range" || this.mode === "above-range") {
      throw new GluonError("REACTOR_UNHEALTHY", "the reactor is outside its healthy range");
    }
    if (erg <= 0n) {
      throw new GluonError("AMOUNT_TOO_SMALL", "fission amount must be greater than zero");
    }
    if (erg > 1000000000000000000n) {
      throw new GluonError("AMOUNT_TOO_LARGE", "reactor cannot release that many tokens");
    }

    const dev = (erg * 3n) / 1000n;
    const outputsMinFee = 1000000n;
    const miner = 2000000n;
    const total = dev + outputsMinFee + miner;
    const neutronsOut = (erg * 1000000000n) / 1500000000n;
    const protonsOut = (erg * 1000000000n) / 500000000n;

    return {
      ergIn: erg,
      ergOut: 0n,
      neutronsIn: 0n,
      neutronsOut,
      protonsIn: 0n,
      protonsOut,
      principal: erg,
      fees: {
        dev,
        ui: 0n,
        oracle: 0n,
        outputsMinFee,
        miner,
        total,
      },
      next: createFakeReactorState(),
      qAfter: 700000000n,
    };
  }

  quoteFusion(_chain: ChainState, erg: bigint): ActionQuote {
    this.calls.push({ method: "quoteFusion", chain: _chain, args: [erg] });
    if (this.mode === "stale-oracle" || (_chain?.oracle?.creationHeight && _chain.height + 1 - _chain.oracle.creationHeight >= 35)) {
      throw new GluonError("ORACLE_STALE", "the oracle price is too old");
    }
    if (this.mode === "below-range" || this.mode === "above-range") {
      throw new GluonError("REACTOR_UNHEALTHY", "the reactor is outside its healthy range");
    }
    if (erg <= 0n) {
      throw new GluonError("AMOUNT_TOO_SMALL", "fusion amount must be greater than zero");
    }
    if (erg >= 1000000000000n) {
      throw new GluonError("AMOUNT_TOO_LARGE", "fusion amount cannot exceed the reactor reserve");
    }

    const dev = (erg * 3n) / 1000n;
    const outputsMinFee = 1000000n;
    const miner = 2000000n;
    const total = dev + outputsMinFee + miner;
    const neutronsIn = (erg * 1000000000n) / 1500000000n;
    const protonsIn = (erg * 1000000000n) / 500000000n;

    return {
      ergIn: 0n,
      ergOut: erg,
      neutronsIn,
      neutronsOut: 0n,
      protonsIn,
      protonsOut: 0n,
      principal: erg,
      fees: {
        dev,
        ui: 0n,
        oracle: 0n,
        outputsMinFee,
        miner,
        total,
      },
      next: createFakeReactorState(),
      qAfter: 700000000n,
    };
  }

  quoteBetaDecayPlus(_chain: ChainState, protons: bigint): ActionQuote {
    this.calls.push({ method: "quoteBetaDecayPlus", chain: _chain, args: [protons] });
    if (this.mode === "stale-oracle" || (_chain?.oracle?.creationHeight && _chain.height + 1 - _chain.oracle.creationHeight >= 35)) {
      throw new GluonError("ORACLE_STALE", "the oracle price is too old");
    }
    if (this.mode === "below-range" || this.mode === "above-range") {
      throw new GluonError("REACTOR_UNHEALTHY", "the reactor is outside its healthy range");
    }
    if (protons <= 0n) {
      throw new GluonError("AMOUNT_TOO_SMALL", "proton amount must be greater than zero");
    }
    if (protons > 1000000000000n) {
      throw new GluonError("AMOUNT_TOO_LARGE", "reactor cannot release that many neutrons");
    }
    if (protons > 50000000000n) {
      throw new GluonError("WOULD_LEAVE_HEALTHY_RANGE", "beta decay would leave the reactor outside the healthy range");
    }
    if (this.mode === "no-buyback" || !_chain?.buyback) {
      throw new GluonError("BUYBACK_UNAVAILABLE", "this beta decay owes an oracle fee, but no buyback box exists");
    }

    const dev = (protons * 3n) / 1000n;
    const oracle = 5000000n;
    const outputsMinFee = 2000000n;
    const miner = 2000000n;
    const total = dev + oracle + outputsMinFee + miner;
    const neutronsOut = (protons * 500000000n) / 1500000000n;

    return {
      ergIn: 0n,
      ergOut: 0n,
      neutronsIn: 0n,
      neutronsOut,
      protonsIn: protons,
      protonsOut: 0n,
      principal: protons,
      fees: {
        dev,
        ui: 0n,
        oracle,
        outputsMinFee,
        miner,
        total,
      },
      next: createFakeReactorState(),
      qAfter: 750000000n,
    };
  }

  quoteBetaDecayMinus(_chain: ChainState, neutrons: bigint): ActionQuote {
    this.calls.push({ method: "quoteBetaDecayMinus", chain: _chain, args: [neutrons] });
    if (this.mode === "stale-oracle" || (_chain?.oracle?.creationHeight && _chain.height + 1 - _chain.oracle.creationHeight >= 35)) {
      throw new GluonError("ORACLE_STALE", "the oracle price is too old");
    }
    if (this.mode === "below-range" || this.mode === "above-range") {
      throw new GluonError("REACTOR_UNHEALTHY", "the reactor is outside its healthy range");
    }
    if (neutrons <= 0n) {
      throw new GluonError("AMOUNT_TOO_SMALL", "neutron amount must be greater than zero");
    }
    if (neutrons > 1000000000000n) {
      throw new GluonError("AMOUNT_TOO_LARGE", "reactor cannot release that many protons");
    }
    if (neutrons > 50000000000n) {
      throw new GluonError("WOULD_LEAVE_HEALTHY_RANGE", "beta decay would leave the reactor outside the healthy range");
    }
    if (this.mode === "no-buyback" || !_chain?.buyback) {
      throw new GluonError("BUYBACK_UNAVAILABLE", "this beta decay owes an oracle fee, but no buyback box exists");
    }

    const dev = (neutrons * 3n) / 1000n;
    const oracle = 5000000n;
    const outputsMinFee = 2000000n;
    const miner = 2000000n;
    const total = dev + oracle + outputsMinFee + miner;
    const protonsOut = (neutrons * 1500000000n) / 500000000n;

    return {
      ergIn: 0n,
      ergOut: 0n,
      neutronsIn: neutrons,
      neutronsOut: 0n,
      protonsIn: 0n,
      protonsOut,
      principal: neutrons,
      fees: {
        dev,
        ui: 0n,
        oracle,
        outputsMinFee,
        miner,
        total,
      },
      next: createFakeReactorState(),
      qAfter: 650000000n,
    };
  }

  quoteAdjustPeg(...args: unknown[]): AdjustPegQuote {
    this.calls.push({ method: "quoteAdjustPeg", args });
    const snap = createFakeSnapshot(this.mode);
    return {
      allowed: !snap.healthy,
      direction: snap.adjustPeg?.direction,
      steps: snap.adjustPeg?.steps || 0,
      nextPegFactor: 990000n,
    };
  }

  buildFission(chain: ChainState, args: unknown): FakeEip12UnsignedTx {
    this.calls.push({ method: "buildFission", chain, args: [chain, args] });
    return {
      inputs: [],
      dataInputs: [],
      outputs: [],
      toBytes: () => new Uint8Array([1, 2, 3]),
    };
  }

  buildFusion(chain: ChainState, args: unknown): FakeEip12UnsignedTx {
    this.calls.push({ method: "buildFusion", chain, args: [chain, args] });
    return {
      inputs: [],
      dataInputs: [],
      outputs: [],
      toBytes: () => new Uint8Array([1, 2, 3]),
    };
  }

  buildBetaDecayPlus(chain: ChainState, args: unknown): FakeEip12UnsignedTx {
    this.calls.push({ method: "buildBetaDecayPlus", chain, args: [chain, args] });
    return {
      inputs: [],
      dataInputs: [],
      outputs: [],
      toBytes: () => new Uint8Array([1, 2, 3]),
    };
  }

  buildBetaDecayMinus(chain: ChainState, args: unknown): FakeEip12UnsignedTx {
    this.calls.push({ method: "buildBetaDecayMinus", chain, args: [chain, args] });
    return {
      inputs: [],
      dataInputs: [],
      outputs: [],
      toBytes: () => new Uint8Array([1, 2, 3]),
    };
  }

  buildAdjustPeg(chain: ChainState, args: unknown): FakeEip12UnsignedTx {
    this.calls.push({ method: "buildAdjustPeg", chain, args: [chain, args] });
    return {
      inputs: [],
      dataInputs: [],
      outputs: [],
      toBytes: () => new Uint8Array([1, 2, 3]),
    };
  }

  buildUpdateTreasury(chain: ChainState, args: unknown): FakeEip12UnsignedTx {
    this.calls.push({ method: "buildUpdateTreasury", chain, args: [chain, args] });
    return {
      inputs: [],
      dataInputs: [],
      outputs: [],
      toBytes: () => new Uint8Array([1, 2, 3]),
    };
  }

  maxBetaDecayPlus(_chain: ChainState): bigint {
    this.calls.push({ method: "maxBetaDecayPlus", chain: _chain, args: [_chain] });
    if (this.mode !== "healthy") {
      return 0n;
    }
    return 50000000000n;
  }

  maxBetaDecayMinus(_chain: ChainState): bigint {
    this.calls.push({ method: "maxBetaDecayMinus", chain: _chain, args: [_chain] });
    if (this.mode !== "healthy") {
      return 0n;
    }
    return 50000000000n;
  }

  findMaxQuote(...args: unknown[]): ActionQuote {
    this.calls.push({ method: "findMaxQuote", args });
    return createFakeQuote();
  }
}
