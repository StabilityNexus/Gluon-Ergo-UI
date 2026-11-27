/**
 * @file handleAdjustPeg.test.ts
 * @description Unit tests for handleAdjustPegStep and waitForReactorBox verifying polling, error classifications, toast behaviors, and wallet interactions.
 * @module test
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { toast } from "sonner";
import { GluonError } from "@stability-nexus/gluon-ergo-sdk";
import type { Box, Amount, EIP12UnsignedTransaction, SignedTransaction } from "@fleet-sdk/common";
import {
  handleAdjustPegStep,
  waitForReactorBox,
  type AdjustPegClient,
} from "@/lib/functions/reactor/handleAdjustPeg";
import type { WalletOperations } from "@/lib/functions/reactor/types";
import { createFakeChainState } from "./fakeClient";

describe("handleAdjustPeg and waitForReactorBox", () => {
  let toastErrorSpy: ReturnType<typeof spyOn>;
  let toastSuccessSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    toastErrorSpy = spyOn(toast, "error").mockImplementation(() => "err-toast-id" as unknown as string | number);
    toastSuccessSpy = spyOn(toast, "success").mockImplementation(() => "ok-toast-id" as unknown as string | number);
  });

  afterEach(() => {
    toastErrorSpy.mockRestore();
    toastSuccessSpy.mockRestore();
  });

  const dummyTx: EIP12UnsignedTransaction = {
    inputs: [],
    dataInputs: [],
    outputs: [],
  } as unknown as EIP12UnsignedTransaction;

  const dummySignedTx: SignedTransaction = {
    id: "tx-adjust-12345",
    inputs: [],
    dataInputs: [],
    outputs: [],
  };

  const dummyBoxes: Box<Amount>[] = [
    {
      boxId: "user-box-1",
      value: "5000000000",
      ergoTree: "0008cd",
      creationHeight: 1200000,
      assets: [],
      additionalRegisters: {},
      transactionId: "tx-prev-1",
      index: 0,
    },
  ];

  const dummyAddress = "9f4QF8AD1nQ3nJahQVkMj8hFSVVzVom77b52JU7EW71Zexg6N8v";

  function createMockWallet(overrides: Partial<WalletOperations> = {}): WalletOperations {
    return {
      getUtxos: overrides.getUtxos ?? (async () => dummyBoxes),
      getChangeAddress: overrides.getChangeAddress ?? (async () => dummyAddress),
      signTx: overrides.signTx ?? (async () => dummySignedTx),
      submitTx: overrides.submitTx ?? (async () => "tx-adjust-12345"),
    };
  }

  describe("waitForReactorBox", () => {
    it("finds box on the first attempt with 1 refresh and 0 sleeps", async () => {
      let refreshCount = 0;
      let sleepCount = 0;
      let clock = 0;
      const targetTxId = "tx-match-1";

      const chainWithBox = createFakeChainState({
        reactor: {
          ...createFakeChainState().reactor,
          transactionId: targetTxId,
        },
      });

      const res = await waitForReactorBox({
        refresh: async () => {
          refreshCount++;
          return chainWithBox;
        },
        txId: targetTxId,
        pollMs: 2000,
        timeoutMs: 60000,
        now: () => clock,
        sleep: async (ms) => {
          clock += ms;
          sleepCount++;
        },
      });

      expect(res.seen).toBe(true);
      expect(res.chain?.reactor.transactionId).toBe(targetTxId);
      expect(refreshCount).toBe(1);
      expect(sleepCount).toBe(0);
    });

    it("finds box on the third attempt with 3 refreshes and 2 sleeps", async () => {
      let refreshCount = 0;
      let sleepCount = 0;
      let clock = 0;
      const targetTxId = "tx-match-3";

      const chainWithoutBox = createFakeChainState({
        reactor: {
          ...createFakeChainState().reactor,
          transactionId: "tx-old",
        },
      });

      const chainWithBox = createFakeChainState({
        reactor: {
          ...createFakeChainState().reactor,
          transactionId: targetTxId,
        },
      });

      const res = await waitForReactorBox({
        refresh: async () => {
          refreshCount++;
          if (refreshCount === 3) {
            return chainWithBox;
          }
          return chainWithoutBox;
        },
        txId: targetTxId,
        pollMs: 2000,
        timeoutMs: 60000,
        now: () => clock,
        sleep: async (ms) => {
          clock += ms;
          sleepCount++;
        },
      });

      expect(res.seen).toBe(true);
      expect(res.chain?.reactor.transactionId).toBe(targetTxId);
      expect(refreshCount).toBe(3);
      expect(sleepCount).toBe(2);
    });

    it("finds box on the last attempt (e.g. 5 attempts with 4 sleeps)", async () => {
      let refreshCount = 0;
      let sleepCount = 0;
      let clock = 0;
      const targetTxId = "tx-match-last";

      const chainWithoutBox = createFakeChainState({
        reactor: {
          ...createFakeChainState().reactor,
          transactionId: "tx-old",
        },
      });

      const chainWithBox = createFakeChainState({
        reactor: {
          ...createFakeChainState().reactor,
          transactionId: targetTxId,
        },
      });

      const res = await waitForReactorBox({
        refresh: async () => {
          refreshCount++;
          if (refreshCount === 5) {
            return chainWithBox;
          }
          return chainWithoutBox;
        },
        txId: targetTxId,
        pollMs: 100,
        timeoutMs: 500, // 5 attempts
        now: () => clock,
        sleep: async (ms) => {
          clock += ms;
          sleepCount++;
        },
      });

      expect(res.seen).toBe(true);
      expect(refreshCount).toBe(5);
      expect(sleepCount).toBe(4);
    });

    it("returns seen: false after elapsed timeout when never seen", async () => {
      let refreshCount = 0;
      let sleepCount = 0;
      let clock = 0;
      const targetTxId = "tx-never-found";

      const chainWithoutBox = createFakeChainState({
        reactor: {
          ...createFakeChainState().reactor,
          transactionId: "tx-other",
        },
      });

      const res = await waitForReactorBox({
        refresh: async () => {
          refreshCount++;
          return chainWithoutBox;
        },
        txId: targetTxId,
        pollMs: 10,
        timeoutMs: 40,
        now: () => clock,
        sleep: async (ms) => {
          clock += ms;
          sleepCount++;
        },
      });

      expect(res.seen).toBe(false);
      expect(res.chain).toBeUndefined();
      expect(refreshCount).toBe(4);
      expect(sleepCount).toBe(4);
      expect(clock).toBe(40);
    });

    it("tolerates transient refresh failures during polling", async () => {
      let refreshCount = 0;
      let sleepCount = 0;
      let clock = 0;
      const targetTxId = "tx-match-tolerant";

      const chainWithBox = createFakeChainState({
        reactor: {
          ...createFakeChainState().reactor,
          transactionId: targetTxId,
        },
      });

      const res = await waitForReactorBox({
        refresh: async () => {
          refreshCount++;
          if (refreshCount === 1) {
            throw new GluonError("BOX_AMBIGUOUS", "Boxes currently updating");
          }
          if (refreshCount === 2) {
            throw new Error("Node transient error");
          }
          return chainWithBox;
        },
        txId: targetTxId,
        pollMs: 10,
        timeoutMs: 50,
        now: () => clock,
        sleep: async (ms) => {
          clock += ms;
          sleepCount++;
        },
      });

      expect(res.seen).toBe(true);
      expect(refreshCount).toBe(3);
      expect(sleepCount).toBe(2);
    });

    it("(a) slow refresh (each call advances clock by 5000, timeoutMs 60000) stops after ~60 s of clock time, not 30 attempts, and returns seen:false", async () => {
      let clock = 0;
      let refreshCount = 0;
      let sleepCount = 0;
      const targetTxId = "tx-match-a";

      const chainWithoutBox = createFakeChainState({
        reactor: {
          ...createFakeChainState().reactor,
          transactionId: "tx-other",
        },
      });

      const res = await waitForReactorBox({
        refresh: async () => {
          refreshCount++;
          clock += 5000;
          return chainWithoutBox;
        },
        txId: targetTxId,
        pollMs: 2000,
        timeoutMs: 60000,
        now: () => clock,
        sleep: async (ms) => {
          clock += ms;
          sleepCount++;
        },
      });

      expect(res.seen).toBe(false);
      expect(clock).toBeGreaterThanOrEqual(60000);
      expect(clock).toBeLessThan(70000);
      // Each cycle takes 5000ms refresh + 2000ms sleep = 7000ms.
      // After ~9 refreshes (61s of clock time), it stops, far below 30 attempts.
      expect(refreshCount).toBeLessThan(15);
      expect(refreshCount).toBeGreaterThan(0);
      expect(sleepCount).toBeGreaterThan(0);
    });

    it("(b) the last sleep is capped to the remaining budget", async () => {
      let clock = 0;
      const sleeps: number[] = [];
      const targetTxId = "tx-match-b";

      const chainWithoutBox = createFakeChainState({
        reactor: {
          ...createFakeChainState().reactor,
          transactionId: "tx-other",
        },
      });

      const res = await waitForReactorBox({
        refresh: async () => chainWithoutBox,
        txId: targetTxId,
        pollMs: 2000,
        timeoutMs: 5000,
        now: () => clock,
        sleep: async (ms) => {
          sleeps.push(ms);
          clock += ms;
        },
      });

      expect(res.seen).toBe(false);
      // With timeoutMs 5000 and pollMs 2000:
      // Attempt 1: fails, remaining 5000 -> sleep 2000 (clock = 2000)
      // Attempt 2: fails, remaining 3000 -> sleep 2000 (clock = 4000)
      // Attempt 3: fails, remaining 1000 -> sleep capped to 1000 (clock = 5000)
      // Next attempt: budget is 0 -> returns seen: false
      expect(sleeps).toEqual([2000, 2000, 1000]);
      expect(clock).toBe(5000);
    });

    it("(c) immediate match = 1 refresh, 0 sleeps", async () => {
      let clock = 0;
      let refreshCount = 0;
      let sleepCount = 0;
      const targetTxId = "tx-immediate-match";

      const chainWithBox = createFakeChainState({
        reactor: {
          ...createFakeChainState().reactor,
          transactionId: targetTxId,
        },
      });

      const res = await waitForReactorBox({
        refresh: async () => {
          refreshCount++;
          return chainWithBox;
        },
        txId: targetTxId,
        pollMs: 2000,
        timeoutMs: 60000,
        now: () => clock,
        sleep: async (ms) => {
          clock += ms;
          sleepCount++;
        },
      });

      expect(res.seen).toBe(true);
      expect(res.chain?.reactor.transactionId).toBe(targetTxId);
      expect(refreshCount).toBe(1);
      expect(sleepCount).toBe(0);
    });
  });

  describe("handleAdjustPegStep", () => {
    it("handles REACTOR_HEALTHY from build: kind healthy with no toast", async () => {
      const client: AdjustPegClient = {
        buildAdjustPeg: () => {
          throw new GluonError("REACTOR_HEALTHY", "the reactor is healthy");
        },
      };

      const res = await handleAdjustPegStep({
        client,
        refresh: async () => createFakeChainState(),
        wallet: createMockWallet(),
      });

      expect(res).toEqual({
        ok: false,
        kind: "healthy",
        message: "The reactor is healthy again; no peg adjustment is needed.",
      });
      expect(toastErrorSpy).not.toHaveBeenCalled();
      expect(toastSuccessSpy).not.toHaveBeenCalled();
    });

    it("handles ORACLE_STALE from build: retry-later with no toast", async () => {
      const client: AdjustPegClient = {
        buildAdjustPeg: () => {
          throw new GluonError("ORACLE_STALE", "the oracle price is too old");
        },
      };

      const res = await handleAdjustPegStep({
        client,
        refresh: async () => createFakeChainState(),
        wallet: createMockWallet(),
      });

      expect(res).toEqual({
        ok: false,
        kind: "retry-later",
        code: "ORACLE_STALE",
        message: "The oracle price is too old. Waiting for the next oracle update (usually a few minutes).",
      });
      expect(toastErrorSpy).not.toHaveBeenCalled();
      expect(toastSuccessSpy).not.toHaveBeenCalled();
    });

    it("handles BOX_AMBIGUOUS from initial refresh: retry-later with no toast", async () => {
      const client: AdjustPegClient = {
        buildAdjustPeg: () => dummyTx,
      };

      const res = await handleAdjustPegStep({
        client,
        refresh: async () => {
          throw new GluonError("BOX_AMBIGUOUS", "ambiguous boxes");
        },
        wallet: createMockWallet(),
      });

      expect(res).toEqual({
        ok: false,
        kind: "retry-later",
        code: "BOX_AMBIGUOUS",
        message: "The reactor or the oracle is being updated right now. Please retry in a minute.",
      });
      expect(toastErrorSpy).not.toHaveBeenCalled();
      expect(toastSuccessSpy).not.toHaveBeenCalled();
    });

    it("handles INSUFFICIENT_FUNDS from build: kind error WITH one error toast", async () => {
      const client: AdjustPegClient = {
        buildAdjustPeg: () => {
          throw new GluonError("INSUFFICIENT_FUNDS", "not enough funds");
        },
      };

      const res = await handleAdjustPegStep({
        client,
        refresh: async () => createFakeChainState(),
        wallet: createMockWallet(),
      });

      expect(res.ok).toBe(false);
      if (!res.ok && res.kind === "error") {
        expect(res.kind).toBe("error");
        expect(res.message).toBe("Not enough ERG or tokens in your wallet for this transaction and its fees.");
      }
      expect(toastErrorSpy).toHaveBeenCalledTimes(1);
      expect(toastSuccessSpy).not.toHaveBeenCalled();
    });

    it("handles wallet sign rejection (code 2): cancelled with no toast, submitTx never called", async () => {
      let submitCalled = false;
      const client: AdjustPegClient = {
        buildAdjustPeg: () => dummyTx,
      };

      const wallet = createMockWallet({
        signTx: async () => {
          const err = new Error("User cancelled");
          (err as unknown as { code: number }).code = 2;
          throw err;
        },
        submitTx: async () => {
          submitCalled = true;
          return "tx-adjust-12345";
        },
      });

      const res = await handleAdjustPegStep({
        client,
        refresh: async () => createFakeChainState(),
        wallet,
      });

      expect(res).toEqual({
        ok: false,
        kind: "cancelled",
      });
      expect(submitCalled).toBe(false);
      expect(toastErrorSpy).not.toHaveBeenCalled();
      expect(toastSuccessSpy).not.toHaveBeenCalled();
    });

    it("handles submit failure with code 2: kind error, no wait, produces error toast", async () => {
      let refreshCount = 0;
      const client: AdjustPegClient = {
        buildAdjustPeg: () => dummyTx,
      };

      const wallet = createMockWallet({
        submitTx: async () => {
          const err = new Error("Transaction rejected by node mempool");
          (err as unknown as { code: number }).code = 2;
          throw err;
        },
      });

      const res = await handleAdjustPegStep({
        client,
        refresh: async () => {
          refreshCount++;
          return createFakeChainState();
        },
        wallet,
      });

      expect(res.ok).toBe(false);
      if (!res.ok && res.kind === "error") {
        expect(res.kind).toBe("error");
      }
      expect(refreshCount).toBe(1); // Only initial refresh, never polled
      expect(toastErrorSpy).toHaveBeenCalledTimes(1);
      expect(toastSuccessSpy).not.toHaveBeenCalled();
    });

    it("handles getUtxos failure: kind error with toast", async () => {
      const client: AdjustPegClient = {
        buildAdjustPeg: () => dummyTx,
      };

      const wallet = createMockWallet({
        getUtxos: async () => {
          throw new Error("Failed to load UTXOs");
        },
      });

      const res = await handleAdjustPegStep({
        client,
        refresh: async () => createFakeChainState(),
        wallet,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.kind).toBe("error");
      }
      expect(toastErrorSpy).toHaveBeenCalledTimes(1);
      expect(toastSuccessSpy).not.toHaveBeenCalled();
    });

    it("calls onSubmitted callback, shows exactly one success toast, passes wallet UTXOs and changeAddress to build", async () => {
      let capturedArgs: unknown = null;
      const client: AdjustPegClient = {
        buildAdjustPeg: (_chain, args) => {
          capturedArgs = args;
          return dummyTx;
        },
      };

      let onSubmittedCalledWith = "";
      const submittedTxHash = "tx-submitted-hash-999";

      const wallet = createMockWallet({
        submitTx: async () => submittedTxHash,
      });

      const chainWithMatchingBox = createFakeChainState({
        reactor: {
          ...createFakeChainState().reactor,
          transactionId: submittedTxHash,
        },
      });

      let refreshCount = 0;
      const res = await handleAdjustPegStep({
        client,
        refresh: async () => {
          refreshCount++;
          return chainWithMatchingBox;
        },
        wallet,
        pollMs: 5,
        timeoutMs: 50,
        sleep: async () => {},
        onSubmitted: (txHash) => {
          onSubmittedCalledWith = txHash;
        },
      });

      expect(res).toEqual({
        ok: true,
        txHash: submittedTxHash,
        seen: true,
        chain: chainWithMatchingBox,
      });

      expect(capturedArgs).toEqual({
        userBoxes: dummyBoxes,
        changeAddress: dummyAddress,
      });

      expect(onSubmittedCalledWith).toBe(submittedTxHash);
      expect(toastSuccessSpy).toHaveBeenCalledTimes(1);
      expect(toastErrorSpy).not.toHaveBeenCalled();
      // initial refresh + 1 poll attempt where box matched
      expect(refreshCount).toBe(2);
    });

    it("passes now clock through handleAdjustPegStep to waitForReactorBox", async () => {
      const targetTxId = "tx-now-passthrough";
      const client: AdjustPegClient = {
        buildAdjustPeg: () => dummyTx,
      };

      const wallet = createMockWallet({
        submitTx: async () => targetTxId,
      });

      const clock = 100000;
      let nowCalled = 0;

      const res = await handleAdjustPegStep({
        client,
        refresh: async () =>
          createFakeChainState({
            reactor: {
              ...createFakeChainState().reactor,
              transactionId: targetTxId,
            },
          }),
        wallet,
        now: () => {
          nowCalled++;
          return clock;
        },
      });

      expect(res.ok).toBe(true);
      expect(nowCalled).toBeGreaterThanOrEqual(1);
    });
  });
});
