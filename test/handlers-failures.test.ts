/**
 * @file handlers-failures.test.ts
 * @description Comprehensive failure, cancellation, and error-handling tests for all swap handlers.
 * @module test
 */
import { describe, expect, it, spyOn, beforeEach, afterEach } from "bun:test";
import { toast } from "sonner";
import { GluonError } from "@stability-nexus/gluon-ergo-sdk";
import { handleFissionSwap } from "@/lib/functions/reactor/handleFission";
import { handleFusionSwap } from "@/lib/functions/reactor/handleFusion";
import { handleTransmutationSwap } from "@/lib/functions/reactor/handleTransmutation";
import type { SwapClient, WalletOperations, SwapListener } from "@/lib/functions/reactor/types";
import type { WalletState, ExpectedChanges } from "@/lib/utils/transaction-listener";
import type { ActionType } from "@/lib/constants/token";
import { FakeGluonClient, createFakeChainState } from "./fakeClient";
import { syntheticGoldDeployment } from "./setup";
import type { SignedTransaction, Box } from "@fleet-sdk/common";

describe("Swap Handlers - Failure & Edge Cases", () => {
  const dummyUtxos: Box<bigint>[] = [
    {
      boxId: "box-dummy-1",
      value: 10000000000n,
      ergoTree: "0008cd...",
      creationHeight: 1250000,
      assets: [],
      additionalRegisters: {},
      transactionId: "tx-prev",
      index: 0,
    },
  ];
  const dummyAddress = "9f4QF8AD1nQ3nJahQVkMj8hFSVVzVom77b52JU7EW71Zexg6N8v";
  const dummySignedTx: SignedTransaction = {
    id: "tx-signed-123",
    inputs: [],
    dataInputs: [],
    outputs: [],
  };
  const dummyPreState: WalletState = {
    erg: "10000000000",
    gau: "5000000000",
    gauc: "5000000000",
    timestamp: 1700000000000,
  };

  interface SavedTxCall {
    txHash: string;
    actionType: ActionType;
    preState: WalletState;
    expectedChanges: ExpectedChanges;
  }

  function createMockWallet(overrides: Partial<WalletOperations> = {}): WalletOperations {
    return {
      getUtxos: overrides.getUtxos || (async () => dummyUtxos),
      getChangeAddress: overrides.getChangeAddress || (async () => dummyAddress),
      signTx: overrides.signTx || (async () => dummySignedTx),
      submitTx: overrides.submitTx || (async () => "tx-submitted-hash"),
    };
  }

  function createMockListener(options?: { throwOnSave?: boolean }): {
    listener: SwapListener;
    savedCalls: SavedTxCall[];
  } {
    const savedCalls: SavedTxCall[] = [];
    return {
      savedCalls,
      listener: {
        saveUpTransaction: (
          txHash: string,
          actionType: ActionType,
          preState: WalletState,
          expectedChanges: ExpectedChanges
        ) => {
          if (options?.throwOnSave) {
            throw new Error("Simulated storage error in saveUpTransaction");
          }
          savedCalls.push({ txHash, actionType, preState, expectedChanges });
        },
      },
    };
  }

  let toastErrorSpy: ReturnType<typeof spyOn>;
  let toastSuccessSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    toastErrorSpy = spyOn(toast, "error").mockImplementation(() => "id" as unknown as string | number);
    toastSuccessSpy = spyOn(toast, "success").mockImplementation(() => "id" as unknown as string | number);
  });

  afterEach(() => {
    toastErrorSpy.mockRestore();
    toastSuccessSpy.mockRestore();
  });

  // 1. Fission Failures
  describe("handleFissionSwap failures", () => {
    it("fails when getUtxos throws, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet({
        getUtxos: async () => { throw new Error("Wallet UTXO fetch failed"); },
      });
      const { listener, savedCalls } = createMockListener();

      const result = await handleFissionSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        ergAmount: 1000000000n,
      });

      expect(result.error).toBeDefined();
      expect(result.txHash).toBeUndefined();
      expect(savedCalls.length).toBe(0);
    });

    it("fails when getChangeAddress throws, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet({
        getChangeAddress: async () => { throw new Error("Change address unavailable"); },
      });
      const { listener, savedCalls } = createMockListener();

      const result = await handleFissionSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        ergAmount: 1000000000n,
      });

      expect(result.error).toBeDefined();
      expect(result.txHash).toBeUndefined();
      expect(savedCalls.length).toBe(0);
    });

    it("fails when quote throws GluonError, maps error, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      fakeClient.quoteFission = () => {
        throw new GluonError("AMOUNT_TOO_LARGE", "Amount exceeds reserve");
      };
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet();
      const { listener, savedCalls } = createMockListener();

      const result = await handleFissionSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        ergAmount: 1000000000n,
      });

      expect(result.error).toBe("The reactor cannot pay out or release that amount.");
      expect(result.txHash).toBeUndefined();
      expect(savedCalls.length).toBe(0);
    });

    it("fails when buildFission throws, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      fakeClient.buildFission = () => { throw new Error("Transaction build error"); };
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet();
      const { listener, savedCalls } = createMockListener();

      const result = await handleFissionSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        ergAmount: 1000000000n,
      });

      expect(result.error).toBeDefined();
      expect(result.txHash).toBeUndefined();
      expect(savedCalls.length).toBe(0);
    });

    it("fails when refresh throws, maps error message, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const refresh = async () => { throw new GluonError("NODE_ERROR", "Cannot reach node"); };
      const wallet = createMockWallet();
      const { listener, savedCalls } = createMockListener();

      const result = await handleFissionSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        ergAmount: 1000000000n,
      });

      expect(result.error).toBe("Could not reach the Ergo node. Retrying.");
      expect(result.txHash).toBeUndefined();
      expect(savedCalls.length).toBe(0);
    });

    it("handles sign rejection (code 2), sets cancelled: true, no toast, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet({
        signTx: async () => {
          const err = new Error("User rejected signing");
          (err as { code?: number }).code = 2;
          throw err;
        },
      });
      const { listener, savedCalls } = createMockListener();

      const result = await handleFissionSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        ergAmount: 1000000000n,
      });

      expect(result.cancelled).toBe(true);
      expect(result.txHash).toBeUndefined();
      expect(result.error).toBeUndefined();
      expect(savedCalls.length).toBe(0);
      expect(toastErrorSpy).not.toHaveBeenCalled();
    });

    it("fails when submitTx throws with code 2, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet({
        submitTx: async () => {
          const err = new Error("Node rejected submission code 2");
          (err as { code?: number }).code = 2;
          throw err;
        },
      });
      const { listener, savedCalls } = createMockListener();

      const result = await handleFissionSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        ergAmount: 1000000000n,
      });

      expect(result.error).toBeDefined();
      expect(result.txHash).toBeUndefined();
      expect(savedCalls.length).toBe(0);
    });

    it("still returns txHash when listener.saveUpTransaction throws", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet({
        submitTx: async () => "tx-fission-successful-hash",
      });
      const { listener } = createMockListener({ throwOnSave: true });

      const result = await handleFissionSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        ergAmount: 1000000000n,
      });

      expect(result.txHash).toBe("tx-fission-successful-hash");
      expect(result.error).toBeUndefined();
    });
  });

  // 2. Fusion Failures
  describe("handleFusionSwap failures", () => {
    it("fails when getUtxos throws, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet({
        getUtxos: async () => { throw new Error("UTXO query failed"); },
      });
      const { listener, savedCalls } = createMockListener();

      const result = await handleFusionSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        ergAmount: 1000000000n,
      });

      expect(result.error).toBeDefined();
      expect(result.txHash).toBeUndefined();
      expect(savedCalls.length).toBe(0);
    });

    it("fails when getChangeAddress throws, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet({
        getChangeAddress: async () => { throw new Error("No change address"); },
      });
      const { listener, savedCalls } = createMockListener();

      const result = await handleFusionSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        ergAmount: 1000000000n,
      });

      expect(result.error).toBeDefined();
      expect(result.txHash).toBeUndefined();
      expect(savedCalls.length).toBe(0);
    });

    it("fails when quote throws GluonError, maps error, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      fakeClient.quoteFusion = () => {
        throw new GluonError("REACTOR_UNHEALTHY", "Unhealthy reactor");
      };
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet();
      const { listener, savedCalls } = createMockListener();

      const result = await handleFusionSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        ergAmount: 1000000000n,
      });

      expect(result.error).toBe("The reactor is outside its healthy range. Trading resumes after the peg is adjusted.");
      expect(savedCalls.length).toBe(0);
    });

    it("fails when buildFusion throws, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      fakeClient.buildFusion = () => { throw new Error("Fusion build failed"); };
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet();
      const { listener, savedCalls } = createMockListener();

      const result = await handleFusionSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        ergAmount: 1000000000n,
      });

      expect(result.error).toBeDefined();
      expect(savedCalls.length).toBe(0);
    });

    it("fails when refresh throws, maps error message, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const refresh = async () => { throw new GluonError("BOX_NOT_FOUND", "No box"); };
      const wallet = createMockWallet();
      const { listener, savedCalls } = createMockListener();

      const result = await handleFusionSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        ergAmount: 1000000000n,
      });

      expect(result.error).toBe("Could not find the reactor or oracle on the network. Check the node.");
      expect(savedCalls.length).toBe(0);
    });

    it("handles sign rejection (code 2), sets cancelled: true, no toast, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet({
        signTx: async () => {
          throw { code: 2, info: "user declined" };
        },
      });
      const { listener, savedCalls } = createMockListener();

      const result = await handleFusionSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        ergAmount: 1000000000n,
      });

      expect(result.cancelled).toBe(true);
      expect(result.txHash).toBeUndefined();
      expect(savedCalls.length).toBe(0);
      expect(toastErrorSpy).not.toHaveBeenCalled();
    });

    it("fails when submitTx throws with code 2, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet({
        submitTx: async () => {
          const err = new Error("Mempool rejected code 2");
          (err as { code?: number }).code = 2;
          throw err;
        },
      });
      const { listener, savedCalls } = createMockListener();

      const result = await handleFusionSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        ergAmount: 1000000000n,
      });

      expect(result.error).toBeDefined();
      expect(savedCalls.length).toBe(0);
    });

    it("still returns txHash when listener.saveUpTransaction throws", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet({
        submitTx: async () => "tx-fusion-successful-hash",
      });
      const { listener } = createMockListener({ throwOnSave: true });

      const result = await handleFusionSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        ergAmount: 1000000000n,
      });

      expect(result.txHash).toBe("tx-fusion-successful-hash");
      expect(result.error).toBeUndefined();
    });
  });

  // 3. Transmutation To-Peg Failures
  describe("handleTransmutationSwap (to-peg) failures", () => {
    it("fails when getUtxos throws, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet({
        getUtxos: async () => { throw new Error("UTXO network error"); },
      });
      const { listener, savedCalls } = createMockListener();

      const result = await handleTransmutationSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        amount: 1000000000n,
        direction: "to-peg",
      });

      expect(result.error).toBeDefined();
      expect(savedCalls.length).toBe(0);
    });

    it("fails when getChangeAddress throws, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet({
        getChangeAddress: async () => { throw new Error("Address error"); },
      });
      const { listener, savedCalls } = createMockListener();

      const result = await handleTransmutationSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        amount: 1000000000n,
        direction: "to-peg",
      });

      expect(result.error).toBeDefined();
      expect(savedCalls.length).toBe(0);
    });

    it("fails when quoteBetaDecayPlus throws GluonError, maps error, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      fakeClient.quoteBetaDecayPlus = () => {
        throw new GluonError("BUYBACK_UNAVAILABLE", "No buyback box");
      };
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet();
      const { listener, savedCalls } = createMockListener();

      const result = await handleTransmutationSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        amount: 1000000000n,
        direction: "to-peg",
      });

      expect(result.error).toBe("Transmutations are paused: the oracle's buyback box is unavailable.");
      expect(savedCalls.length).toBe(0);
    });

    it("fails when buildBetaDecayPlus throws, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      fakeClient.buildBetaDecayPlus = () => { throw new Error("Build plus failed"); };
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet();
      const { listener, savedCalls } = createMockListener();

      const result = await handleTransmutationSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        amount: 1000000000n,
        direction: "to-peg",
      });

      expect(result.error).toBeDefined();
      expect(savedCalls.length).toBe(0);
    });

    it("fails when refresh throws, maps error message, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const refresh = async () => { throw new GluonError("ORACLE_STALE", "Oracle too old"); };
      const wallet = createMockWallet();
      const { listener, savedCalls } = createMockListener();

      const result = await handleTransmutationSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        amount: 1000000000n,
        direction: "to-peg",
      });

      expect(result.error).toBe("The oracle price is too old. Waiting for the next oracle update (usually a few minutes).");
      expect(savedCalls.length).toBe(0);
    });

    it("handles sign rejection (code 2), sets cancelled: true, no toast, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet({
        signTx: async () => {
          throw { code: 2, message: "user cancelled signing" };
        },
      });
      const { listener, savedCalls } = createMockListener();

      const result = await handleTransmutationSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        amount: 1000000000n,
        direction: "to-peg",
      });

      expect(result.cancelled).toBe(true);
      expect(result.txHash).toBeUndefined();
      expect(savedCalls.length).toBe(0);
      expect(toastErrorSpy).not.toHaveBeenCalled();
    });

    it("fails when submitTx throws with code 2, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet({
        submitTx: async () => {
          const err = new Error("Node rejected code 2");
          (err as { code?: number }).code = 2;
          throw err;
        },
      });
      const { listener, savedCalls } = createMockListener();

      const result = await handleTransmutationSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        amount: 1000000000n,
        direction: "to-peg",
      });

      expect(result.error).toBeDefined();
      expect(savedCalls.length).toBe(0);
    });

    it("still returns txHash when listener.saveUpTransaction throws", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet({
        submitTx: async () => "tx-transmute-to-peg-success",
      });
      const { listener } = createMockListener({ throwOnSave: true });

      const result = await handleTransmutationSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        amount: 1000000000n,
        direction: "to-peg",
      });

      expect(result.txHash).toBe("tx-transmute-to-peg-success");
      expect(result.error).toBeUndefined();
    });
  });

  // 4. Transmutation From-Peg Failures
  describe("handleTransmutationSwap (from-peg) failures", () => {
    it("fails when getUtxos throws, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet({
        getUtxos: async () => { throw new Error("UTXO connection lost"); },
      });
      const { listener, savedCalls } = createMockListener();

      const result = await handleTransmutationSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        amount: 1000000000n,
        direction: "from-peg",
      });

      expect(result.error).toBeDefined();
      expect(savedCalls.length).toBe(0);
    });

    it("fails when getChangeAddress throws, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet({
        getChangeAddress: async () => { throw new Error("No change address"); },
      });
      const { listener, savedCalls } = createMockListener();

      const result = await handleTransmutationSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        amount: 1000000000n,
        direction: "from-peg",
      });

      expect(result.error).toBeDefined();
      expect(savedCalls.length).toBe(0);
    });

    it("fails when quoteBetaDecayMinus throws GluonError, maps error, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      fakeClient.quoteBetaDecayMinus = () => {
        throw new GluonError("WOULD_LEAVE_HEALTHY_RANGE", "Exceeds healthy bounds");
      };
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet();
      const { listener, savedCalls } = createMockListener();

      const result = await handleTransmutationSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        amount: 1000000000n,
        direction: "from-peg",
      });

      expect(result.error).toBe("This amount would push the reactor out of its healthy range.");
      expect(savedCalls.length).toBe(0);
    });

    it("fails when buildBetaDecayMinus throws, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      fakeClient.buildBetaDecayMinus = () => { throw new Error("Build minus failed"); };
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet();
      const { listener, savedCalls } = createMockListener();

      const result = await handleTransmutationSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        amount: 1000000000n,
        direction: "from-peg",
      });

      expect(result.error).toBeDefined();
      expect(savedCalls.length).toBe(0);
    });

    it("fails when refresh throws, maps error message, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const refresh = async () => { throw new GluonError("BOX_AMBIGUOUS", "Ambiguous box"); };
      const wallet = createMockWallet();
      const { listener, savedCalls } = createMockListener();

      const result = await handleTransmutationSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        amount: 1000000000n,
        direction: "from-peg",
      });

      expect(result.error).toBe("The reactor or the oracle is being updated right now. Please retry in a minute.");
      expect(savedCalls.length).toBe(0);
    });

    it("handles sign rejection (code 2), sets cancelled: true, no toast, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet({
        signTx: async () => {
          throw { code: 2, info: "cancelled by user" };
        },
      });
      const { listener, savedCalls } = createMockListener();

      const result = await handleTransmutationSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        amount: 1000000000n,
        direction: "from-peg",
      });

      expect(result.cancelled).toBe(true);
      expect(result.txHash).toBeUndefined();
      expect(savedCalls.length).toBe(0);
      expect(toastErrorSpy).not.toHaveBeenCalled();
    });

    it("fails when submitTx throws with code 2, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet({
        submitTx: async () => {
          const err = new Error("Code 2 error on submit");
          (err as { code?: number }).code = 2;
          throw err;
        },
      });
      const { listener, savedCalls } = createMockListener();

      const result = await handleTransmutationSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        amount: 1000000000n,
        direction: "from-peg",
      });

      expect(result.error).toBeDefined();
      expect(savedCalls.length).toBe(0);
    });

    it("still returns txHash when listener.saveUpTransaction throws", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const refresh = async () => createFakeChainState();
      const wallet = createMockWallet({
        submitTx: async () => "tx-transmute-from-peg-success",
      });
      const { listener } = createMockListener({ throwOnSave: true });

      const result = await handleTransmutationSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        amount: 1000000000n,
        direction: "from-peg",
      });

      expect(result.txHash).toBe("tx-transmute-from-peg-success");
      expect(result.error).toBeUndefined();
    });
  });
});
