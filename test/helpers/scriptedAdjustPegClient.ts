/**
 * @file scriptedAdjustPegClient.ts
 * @description Controllable fake Gluon client for testing the multi-step Adjust Peg flow, mempool delays, and state transitions.
 * @module test/helpers
 */

import {
  GluonError,
  type ChainState,
  type ProtocolSnapshot,
  type AdjustPegQuote,
} from "@stability-nexus/gluon-ergo-sdk";
import {
  FakeGluonClient,
  createFakeChainState,
  createFakeSnapshot,
  type FakeEip12UnsignedTx,
} from "../fakeClient";

export interface ScriptedAdjustPegOptions {
  stepsToHealthy: number;
  direction: "down" | "up";
  confirmAfterFetches?: number;
}

export interface ScriptedUnsignedTx extends FakeEip12UnsignedTx {
  id: string;
}

export class ScriptedAdjustPegClient extends FakeGluonClient {
  public readonly minerFee: bigint = 2000000n;
  public stepsRemaining: number;
  public direction: "down" | "up";
  public confirmAfterFetches: number;
  public confirmedTxId: string = "genesis-reactor-tx";
  public pendingTxId?: string;
  public fetchesUntilVisible: number = 0;
  public oracleStale: boolean = false;
  public fetchGate?: Promise<void>;
  private txCounter: number = 0;

  constructor(options: ScriptedAdjustPegOptions) {
    super(
      options.stepsToHealthy === 0
        ? "healthy"
        : options.direction === "down"
          ? "above-range"
          : "below-range"
    );
    this.stepsRemaining = options.stepsToHealthy;
    this.direction = options.direction;
    this.confirmAfterFetches = options.confirmAfterFetches ?? 0;
  }

  public override async fetchChainState(): Promise<ChainState> {
    if (this.fetchGate !== undefined) {
      await this.fetchGate;
    }
    this.calls.push({ method: "fetchChainState", args: [] });

    if (this.pendingTxId !== undefined) {
      this.fetchesUntilVisible -= 1;
      if (this.fetchesUntilVisible < 0) {
        this.confirmedTxId = this.pendingTxId;
        this.pendingTxId = undefined;
        this.stepsRemaining = Math.max(0, this.stepsRemaining - 1);
      }
    }

    const baseChain = createFakeChainState();
    const height = baseChain.height;
    const creationHeight = this.oracleStale ? height + 1 - 40 : baseChain.oracle.creationHeight;

    return {
      ...baseChain,
      reactor: {
        ...baseChain.reactor,
        transactionId: this.confirmedTxId,
      },
      oracle: {
        ...baseChain.oracle,
        creationHeight,
      },
    };
  }

  public override snapshot(_chain?: ChainState): ProtocolSnapshot {
    this.calls.push({ method: "snapshot", chain: _chain, args: [_chain] });

    if (this.stepsRemaining > 0) {
      const mode = this.direction === "down" ? "above-range" : "below-range";
      const snap = createFakeSnapshot(mode);
      return {
        ...snap,
        oracleAge: this.oracleStale ? 40 : snap.oracleAge,
        adjustPeg: {
          direction: this.direction,
          steps: this.stepsRemaining,
        },
      };
    }

    const snap = createFakeSnapshot("healthy");
    return {
      ...snap,
      oracleAge: this.oracleStale ? 40 : snap.oracleAge,
    };
  }

  public override quoteAdjustPeg(...args: unknown[]): AdjustPegQuote {
    this.calls.push({ method: "quoteAdjustPeg", args });
    return {
      allowed: this.stepsRemaining > 0,
      direction: this.direction,
      steps: this.stepsRemaining,
      nextPegFactor: this.direction === "down" ? 990000n : 1010000n,
    };
  }

  public override buildAdjustPeg(
    chain: ChainState,
    funding: unknown
  ): ScriptedUnsignedTx {
    this.calls.push({ method: "buildAdjustPeg", chain, args: [chain, funding] });

    if (this.stepsRemaining === 0) {
      throw new GluonError("REACTOR_HEALTHY", "the reactor is in its healthy range, so Adjust Peg is not allowed");
    }
    if (this.oracleStale) {
      throw new GluonError("ORACLE_STALE", "the oracle price is too old");
    }

    this.txCounter += 1;
    const txId = `adjust-tx-${this.txCounter}`;
    return {
      id: txId,
      inputs: [],
      dataInputs: [],
      outputs: [],
      toBytes: () => new Uint8Array([1, 2, 3]),
    };
  }

  public markSubmitted(txId: string): void {
    this.pendingTxId = txId;
    this.fetchesUntilVisible = this.confirmAfterFetches;
  }

  public finishExternally(): void {
    this.stepsRemaining = 0;
  }

  public setOracleStale(stale: boolean): void {
    this.oracleStale = stale;
  }
}
