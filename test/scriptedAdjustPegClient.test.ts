/**
 * @file scriptedAdjustPegClient.test.ts
 * @description Unit tests for ScriptedAdjustPegClient verifying state evolution over fetches, delayed visibility, snapshot/quote calculations, and error throws.
 * @module test
 */

import { describe, it, expect } from "bun:test";
import { GluonError } from "@stability-nexus/gluon-ergo-sdk";
import { ScriptedAdjustPegClient } from "./helpers/scriptedAdjustPegClient";
import { createFakeChainState } from "./fakeClient";

describe("ScriptedAdjustPegClient", () => {
  it("initializes with correct properties, initial confirmed txId, and quote values", () => {
    const client = new ScriptedAdjustPegClient({
      stepsToHealthy: 2,
      direction: "down",
      confirmAfterFetches: 2,
    });

    expect(client.minerFee).toBe(2000000n);
    expect(client.confirmedTxId).toBe("genesis-reactor-tx");
    expect(client.stepsRemaining).toBe(2);
    expect(client.direction).toBe("down");

    const quote = client.quoteAdjustPeg();
    expect(quote.allowed).toBe(true);
    expect(quote.direction).toBe("down");
    expect(quote.steps).toBe(2);

    const snap = client.snapshot();
    expect(snap.healthy).toBe(false);
    expect(snap.adjustPeg?.direction).toBe("down");
    expect(snap.adjustPeg?.steps).toBe(2);
  });

  it("handles state evolution and confirmation delay over fetches", async () => {
    const client = new ScriptedAdjustPegClient({
      stepsToHealthy: 2,
      direction: "up",
      confirmAfterFetches: 2,
    });

    // Initial fetch before submission
    const initialChain = await client.fetchChainState();
    expect(initialChain.reactor.transactionId).toBe("genesis-reactor-tx");
    expect(client.stepsRemaining).toBe(2);

    // Mark tx submitted with confirmAfterFetches = 2
    client.markSubmitted("adjust-tx-1");

    // Fetch 1: still pending
    const chain1 = await client.fetchChainState();
    expect(chain1.reactor.transactionId).toBe("genesis-reactor-tx");
    expect(client.stepsRemaining).toBe(2);

    // Fetch 2: still pending
    const chain2 = await client.fetchChainState();
    expect(chain2.reactor.transactionId).toBe("genesis-reactor-tx");
    expect(client.stepsRemaining).toBe(2);

    // Fetch 3: confirmed!
    const chain3 = await client.fetchChainState();
    expect(chain3.reactor.transactionId).toBe("adjust-tx-1");
    expect(client.stepsRemaining).toBe(1);

    // Quote and snapshot reflect updated remaining steps
    const updatedQuote = client.quoteAdjustPeg();
    expect(updatedQuote.steps).toBe(1);
    expect(updatedQuote.allowed).toBe(true);

    const updatedSnap = client.snapshot();
    expect(updatedSnap.adjustPeg?.steps).toBe(1);
  });

  it("produces incrementing tx IDs and records build arguments", () => {
    const client = new ScriptedAdjustPegClient({
      stepsToHealthy: 2,
      direction: "down",
    });

    const chain = createFakeChainState();
    const funding = { userBoxes: [], changeAddress: "test-addr" };

    const tx1 = client.buildAdjustPeg(chain, funding);
    expect(tx1.id).toBe("adjust-tx-1");

    const tx2 = client.buildAdjustPeg(chain, funding);
    expect(tx2.id).toBe("adjust-tx-2");

    expect(client.calls.filter((c) => c.method === "buildAdjustPeg")).toHaveLength(2);
    expect(client.calls[0].args).toEqual([chain, funding]);
  });

  it("throws REACTOR_HEALTHY when stepsRemaining is 0", () => {
    const client = new ScriptedAdjustPegClient({
      stepsToHealthy: 0,
      direction: "down",
    });

    const chain = createFakeChainState();
    const funding = { userBoxes: [], changeAddress: "test-addr" };

    expect(() => client.buildAdjustPeg(chain, funding)).toThrow(GluonError);
    expect(client.quoteAdjustPeg().allowed).toBe(false);
    expect(client.snapshot().healthy).toBe(true);
  });

  it("finishExternally sets stepsRemaining to 0 and makes reactor healthy", () => {
    const client = new ScriptedAdjustPegClient({
      stepsToHealthy: 3,
      direction: "up",
    });

    client.finishExternally();
    expect(client.stepsRemaining).toBe(0);
    expect(client.quoteAdjustPeg().allowed).toBe(false);
    expect(client.snapshot().healthy).toBe(true);

    const chain = createFakeChainState();
    expect(() => client.buildAdjustPeg(chain, { userBoxes: [], changeAddress: "addr" })).toThrow(
      GluonError
    );
  });

  it("setOracleStale marks oracle stale and causes buildAdjustPeg to throw ORACLE_STALE", async () => {
    const client = new ScriptedAdjustPegClient({
      stepsToHealthy: 1,
      direction: "down",
    });

    client.setOracleStale(true);
    expect(client.oracleStale).toBe(true);

    const chain = await client.fetchChainState();
    const oracleAge = chain.height + 1 - chain.oracle.creationHeight;
    expect(oracleAge).toBeGreaterThanOrEqual(35);

    const snap = client.snapshot();
    expect(snap.oracleAge).toBe(40);

    expect(() => client.buildAdjustPeg(chain, { userBoxes: [], changeAddress: "addr" })).toThrow(
      GluonError
    );
  });
});
