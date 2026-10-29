/**
 * @file handlers.test.ts
 * @description Unit tests for swap handlers, history.ts mapping, sign/submit separation, listener integration, and error handling.
 * @module test
 */
import { describe, expect, it } from "bun:test";
import { GluonError, type ActionQuote, type ChainState } from "@stability-nexus/gluon-ergo-sdk";
import { ACTION_TYPES, type ActionType } from "@/lib/constants/token";
import { buildExpectedChanges } from "@/lib/functions/reactor/history";
import { handleFissionSwap } from "@/lib/functions/reactor/handleFission";
import { handleFusionSwap } from "@/lib/functions/reactor/handleFusion";
import { handleTransmutationSwap } from "@/lib/functions/reactor/handleTransmutation";
import { FakeGluonClient, createFakeChainState, createFakeReactorState } from "./fakeClient";
import { syntheticGoldDeployment } from "./setup";
import type { SwapClient, SwapListener, WalletOperations, WalletState } from "@/lib/functions/reactor/types";
import type { ExpectedChanges } from "@/lib/utils/transaction-listener";
import type { Box, Amount, EIP12UnsignedTransaction, SignedTransaction } from "@fleet-sdk/common";

describe("history.ts > buildExpectedChanges", () => {
  const dummyReactor = createFakeReactorState();

  it("maps FISSION with concrete numbers to expected changes", () => {
    const quote: ActionQuote = {
      ergIn: 1000000000n, // 1 ERG
      ergOut: 0n,
      neutronsIn: 0n,
      neutronsOut: 500000000n, // 0.5 GAU
      protonsIn: 0n,
      protonsOut: 500000000n, // 0.5 GAUC
      principal: 980000000n,
      fees: {
        dev: 10000000n,
        ui: 0n,
        oracle: 5000000n,
        outputsMinFee: 2000000n,
        miner: 1000000n,
        total: 18000000n,
      },
      next: dummyReactor,
      qAfter: 720000000n,
    };

    const changes = buildExpectedChanges(ACTION_TYPES.FISSION, quote, syntheticGoldDeployment);
    expect(changes).toEqual({
      erg: "-1000000000",
      gau: "500000000",
      gauc: "500000000",
      fees: "-18000000",
    });
  });

  it("maps FUSION with concrete numbers to expected changes", () => {
    const quote: ActionQuote = {
      ergIn: 0n,
      ergOut: 1000000000n, // 1 ERG redeemed
      neutronsIn: 400000000n, // 0.4 GAU burnt
      neutronsOut: 0n,
      protonsIn: 600000000n, // 0.6 GAUC burnt
      protonsOut: 0n,
      principal: 980000000n,
      fees: {
        dev: 10000000n,
        ui: 0n,
        oracle: 5000000n,
        outputsMinFee: 2000000n,
        miner: 1000000n,
        total: 18000000n,
      },
      next: dummyReactor,
      qAfter: 680000000n,
    };

    const changes = buildExpectedChanges(ACTION_TYPES.FUSION, quote, syntheticGoldDeployment);
    expect(changes).toEqual({
      erg: "1000000000",
      gau: "-400000000",
      gauc: "-600000000",
      fees: "-18000000",
    });
  });

  it("maps TRANSMUTE_TO_PEG (Beta Decay Plus) with concrete numbers to expected changes", () => {
    const quote: ActionQuote = {
      ergIn: 0n,
      ergOut: 0n,
      neutronsIn: 0n,
      neutronsOut: 1000000000n, // 1 GAU received
      protonsIn: 3000000000n, // 3 GAUC burnt
      protonsOut: 0n,
      principal: 3000000000n,
      fees: {
        dev: 9000000n,
        ui: 0n,
        oracle: 5000000n,
        outputsMinFee: 2000000n,
        miner: 2000000n,
        total: 18000000n,
      },
      next: dummyReactor,
      qAfter: 750000000n,
    };

    const changes = buildExpectedChanges(ACTION_TYPES.TRANSMUTE_TO_PEG, quote, syntheticGoldDeployment);
    expect(changes).toEqual({
      erg: "0",
      gau: "1000000000",
      gauc: "-3000000000",
      fees: "-18000000",
    });
  });

  it("maps TRANSMUTE_FROM_PEG (Beta Decay Minus) with concrete numbers to expected changes", () => {
    const quote: ActionQuote = {
      ergIn: 0n,
      ergOut: 0n,
      neutronsIn: 1000000000n, // 1 GAU burnt
      neutronsOut: 0n,
      protonsIn: 0n,
      protonsOut: 3000000000n, // 3 GAUC received
      principal: 1000000000n,
      fees: {
        dev: 3000000n,
        ui: 0n,
        oracle: 5000000n,
        outputsMinFee: 2000000n,
        miner: 2000000n,
        total: 12000000n,
      },
      next: dummyReactor,
      qAfter: 650000000n,
    };

    const changes = buildExpectedChanges(ACTION_TYPES.TRANSMUTE_FROM_PEG, quote, syntheticGoldDeployment);
    expect(changes).toEqual({
      erg: "0",
      gau: "-1000000000",
      gauc: "3000000000",
      fees: "-12000000",
    });
  });
});

describe("Swap Handlers", () => {
  const dummyUtxos: Box<Amount>[] = [
    {
      boxId: "box-1",
      value: 10000000000n,
      ergoTree: "0008cd...",
      creationHeight: 1200000,
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

  describe("handleFissionSwap", () => {
    it("calls refresh before and after building, passes UTXOs/changeAddress, and saves exact expected changes", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const order: string[] = [];

      const freshChain1 = createFakeChainState({ height: 1250001 });
      const freshChain2 = createFakeChainState({ height: 1250002 });
      let refreshCount = 0;

      const refresh = async (): Promise<ChainState> => {
        refreshCount++;
        order.push(`refresh-${refreshCount}`);
        return refreshCount === 1 ? freshChain1 : freshChain2;
      };

      const wallet = createMockWallet({
        getUtxos: async () => {
          order.push("getUtxos");
          return dummyUtxos;
        },
        getChangeAddress: async () => {
          order.push("getChangeAddress");
          return dummyAddress;
        },
        signTx: async (unsigned: EIP12UnsignedTransaction) => {
          void unsigned;
          order.push("signTx");
          return dummySignedTx;
        },
        submitTx: async (signed: SignedTransaction) => {
          void signed;
          order.push("submitTx");
          return "tx-fission-success";
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

      expect(result.txHash).toBe("tx-fission-success");
      expect(result.cancelled).toBeUndefined();

      // Assert call order: refresh 1 -> getUtxos/changeAddress -> signTx -> submitTx -> refresh 2
      expect(order[0]).toBe("refresh-1");
      expect(order).toContain("signTx");
      expect(order).toContain("submitTx");
      expect(order[order.length - 1]).toBe("refresh-2");

      // Assert fakeClient received the exact fresh chain from refresh 1
      const buildCall = fakeClient.calls.find((c) => c.method === "buildFission");
      expect(buildCall).toBeDefined();
      expect(buildCall?.chain).toBe(freshChain1);

      // Assert listener received exact arguments
      expect(savedCalls.length).toBe(1);
      expect(savedCalls[0].txHash).toBe("tx-fission-success");
      expect(savedCalls[0].actionType).toBe("fission");
      expect(savedCalls[0].preState).toBe(dummyPreState);
      expect(savedCalls[0].expectedChanges).toEqual({
        erg: "-1000000000",
        gau: "666666666",
        gauc: "2000000000",
        fees: "-6000000",
      });
    });

    it("silently handles signTx rejection (code 2) without throwing or saving to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const chain = createFakeChainState();
      const refresh = async () => chain;

      const wallet = createMockWallet({
        signTx: async () => {
          const err = new Error("User declined the transaction");
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
    });

    it("treats submitTx failure as error, does not save to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const chain = createFakeChainState();
      const refresh = async () => chain;

      const wallet = createMockWallet({
        submitTx: async () => {
          const err = new Error("Node rejected transaction with code 2");
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

      expect(result.cancelled).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(savedCalls.length).toBe(0);
    });

    it("does not save to listener if buildFission throws", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      fakeClient.buildFission = () => {
        throw new Error("Build fission failed");
      };
      const chain = createFakeChainState();
      const refresh = async () => chain;
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
      expect(savedCalls.length).toBe(0);
    });

    it("does not fail an already submitted swap if saveUpTransaction throws", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const chain = createFakeChainState();
      const refresh = async () => chain;
      const wallet = createMockWallet({
        submitTx: async () => "tx-hash-already-submitted",
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

      expect(result.txHash).toBe("tx-hash-already-submitted");
      expect(result.error).toBeUndefined();
    });

    it("maps refresh failure through getGluonErrorMessage", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const refresh = async () => {
        throw new GluonError("NODE_ERROR", "Cannot contact node");
      };
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
      expect(savedCalls.length).toBe(0);
    });
  });

  describe("handleFusionSwap", () => {
    it("calls refresh before and after building, passes UTXOs/changeAddress, and saves exact expected changes", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const freshChain1 = createFakeChainState({ height: 1250005 });
      const freshChain2 = createFakeChainState({ height: 1250006 });
      let refreshCount = 0;

      const refresh = async (): Promise<ChainState> => {
        refreshCount++;
        return refreshCount === 1 ? freshChain1 : freshChain2;
      };

      const wallet = createMockWallet({
        submitTx: async () => "tx-fusion-success",
      });
      const { listener, savedCalls } = createMockListener();

      const result = await handleFusionSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        ergAmount: 2000000000n,
      });

      expect(result.txHash).toBe("tx-fusion-success");
      expect(savedCalls.length).toBe(1);
      expect(savedCalls[0].txHash).toBe("tx-fusion-success");
      expect(savedCalls[0].actionType).toBe("fusion");
      expect(savedCalls[0].preState).toBe(dummyPreState);
      expect(savedCalls[0].expectedChanges.erg).toBe("2000000000");
      expect(BigInt(savedCalls[0].expectedChanges.gau)).toBeLessThan(0n);
      expect(BigInt(savedCalls[0].expectedChanges.gauc)).toBeLessThan(0n);
      expect(BigInt(savedCalls[0].expectedChanges.fees)).toBeLessThan(0n);
    });

    it("silently handles signTx rejection without saving to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const chain = createFakeChainState();
      const refresh = async () => chain;

      const wallet = createMockWallet({
        signTx: async () => {
          throw { code: 2, info: "cancelled by user" };
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
      expect(savedCalls.length).toBe(0);
    });

    it("does not fail an already submitted swap if saveUpTransaction throws", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const chain = createFakeChainState();
      const refresh = async () => chain;
      const wallet = createMockWallet({
        submitTx: async () => "tx-fusion-hash-submitted",
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

      expect(result.txHash).toBe("tx-fusion-hash-submitted");
      expect(result.error).toBeUndefined();
    });
  });

  describe("handleTransmutationSwap", () => {
    it("handles to-peg direction, building buildBetaDecayPlus and saving to listener on success", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const freshChain = createFakeChainState({ height: 1250010 });
      const refresh = async () => freshChain;
      const wallet = createMockWallet({
        submitTx: async () => "tx-transmute-to-peg",
      });
      const { listener, savedCalls } = createMockListener();

      const result = await handleTransmutationSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        amount: 5000000000n,
        direction: "to-peg",
      });

      expect(result.txHash).toBe("tx-transmute-to-peg");
      expect(savedCalls.length).toBe(1);
      expect(savedCalls[0].txHash).toBe("tx-transmute-to-peg");
      expect(savedCalls[0].actionType).toBe("transmute-to-gold");
      expect(savedCalls[0].preState).toBe(dummyPreState);
      expect(savedCalls[0].expectedChanges.erg).toBe("0");
      expect(BigInt(savedCalls[0].expectedChanges.gau)).toBeGreaterThan(0n);
      expect(BigInt(savedCalls[0].expectedChanges.gauc)).toBeLessThan(0n);
      expect(BigInt(savedCalls[0].expectedChanges.fees)).toBeLessThan(0n);
    });

    it("handles from-peg direction, building buildBetaDecayMinus and saving to listener on success", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const freshChain = createFakeChainState({ height: 1250015 });
      const refresh = async () => freshChain;
      const wallet = createMockWallet({
        submitTx: async () => "tx-transmute-from-peg",
      });
      const { listener, savedCalls } = createMockListener();

      const result = await handleTransmutationSwap({
        client: fakeClient as unknown as SwapClient,
        deployment: syntheticGoldDeployment,
        refresh,
        wallet,
        listener,
        preState: dummyPreState,
        amount: 3000000000n,
        direction: "from-peg",
      });

      expect(result.txHash).toBe("tx-transmute-from-peg");
      expect(savedCalls.length).toBe(1);
      expect(savedCalls[0].txHash).toBe("tx-transmute-from-peg");
      expect(savedCalls[0].actionType).toBe("transmute-from-gold");
      expect(savedCalls[0].preState).toBe(dummyPreState);
      expect(savedCalls[0].expectedChanges.erg).toBe("0");
      expect(BigInt(savedCalls[0].expectedChanges.gau)).toBeLessThan(0n);
      expect(BigInt(savedCalls[0].expectedChanges.gauc)).toBeGreaterThan(0n);
      expect(BigInt(savedCalls[0].expectedChanges.fees)).toBeLessThan(0n);
    });

    it("silently handles wallet rejection on signTx without saving to listener", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const chain = createFakeChainState();
      const refresh = async () => chain;

      const wallet = createMockWallet({
        signTx: async () => {
          throw "user rejected request";
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
      expect(savedCalls.length).toBe(0);
    });

    it("does not fail an already submitted swap if saveUpTransaction throws", async () => {
      const fakeClient = new FakeGluonClient("healthy");
      const chain = createFakeChainState();
      const refresh = async () => chain;
      const wallet = createMockWallet({
        submitTx: async () => "tx-transmute-hash-submitted",
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

      expect(result.txHash).toBe("tx-transmute-hash-submitted");
      expect(result.error).toBeUndefined();
    });
  });
});
