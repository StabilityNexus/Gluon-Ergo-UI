import { describe, expect, test, beforeEach } from "bun:test";
import "../../../tests/setup"; // Import setup to ensure localStorage mock is available
import { TransactionListener } from "@/lib/utils/transaction-listener";
import type { WalletState, ExpectedChanges } from "@/lib/utils/transaction-listener";
import { NodeService } from "@/lib/utils/node-service";

describe("TransactionListener", () => {
    let listener: TransactionListener;
    let mockNodeService: any;

    beforeEach(() => {
        // Clear localStorage before each test
        if (typeof localStorage !== 'undefined') {
            localStorage.clear();
        }

        // Create mock NodeService
        mockNodeService = {
            getUnconfirmedTransactionById: () => Promise.resolve(null),
            getTxsById: () => Promise.resolve(null),
        };

        listener = new TransactionListener(mockNodeService as NodeService);
    });

    describe("saveUpTransaction", () => {
        test("should save transaction to localStorage", () => {
            const txHash = "abc123";
            const actionType = "fission";
            const preTransactionState: WalletState = {
                erg: "1000000000",
                gau: "0",
                gauc: "0",
                timestamp: Date.now(),
            };
            const expectedChanges: ExpectedChanges = {
                erg: "-500000000",
                gau: "250000000",
                gauc: "250000000",
                fees: "-1000000",
            };

            listener.saveUpTransaction(txHash, actionType, preTransactionState, expectedChanges);

            const stored = localStorage.getItem("gluon_pending_transactions");
            expect(stored).not.toBeNull();

            if (stored) {
                const parsed = JSON.parse(stored);
                expect(parsed[txHash]).toBeDefined();
                expect(parsed[txHash].actionType).toBe(actionType);
                expect(parsed[txHash].isConfirmed).toBe(false);
                expect(parsed[txHash].isWalletUpdated).toBe(false);
            }
        });

        test("should store transaction with correct structure", () => {
            const txHash = "test123";
            const actionType = "fusion";
            const preTransactionState: WalletState = {
                erg: "1000000000",
                gau: "500000000",
                gauc: "500000000",
                timestamp: Date.now(),
            };
            const expectedChanges: ExpectedChanges = {
                erg: "1000000000",
                gau: "-500000000",
                gauc: "-500000000",
                fees: "-1000000",
            };

            listener.saveUpTransaction(txHash, actionType, preTransactionState, expectedChanges);

            const stored = localStorage.getItem("gluon_pending_transactions");
            if (stored) {
                const parsed = JSON.parse(stored);
                const tx = parsed[txHash];

                expect(tx.txHash).toBe(txHash);
                expect(tx.actionType).toBe(actionType);
                expect(tx.preTransactionState).toEqual(preTransactionState);
                expect(tx.expectedChanges).toEqual(expectedChanges);
                expect(tx.retryCount).toBe(0);
            }
        });

        test("should handle multiple transactions", () => {
            listener.saveUpTransaction("tx1", "fission", { erg: "1000000000", gau: "0", gauc: "0", timestamp: Date.now() }, { erg: "-500000000", gau: "250000000", gauc: "250000000", fees: "-1000000" });
            listener.saveUpTransaction("tx2", "fusion", { erg: "1000000000", gau: "500000000", gauc: "500000000", timestamp: Date.now() }, { erg: "1000000000", gau: "-500000000", gauc: "-500000000", fees: "-1000000" });

            const stored = localStorage.getItem("gluon_pending_transactions");
            if (stored) {
                const parsed = JSON.parse(stored);
                expect(Object.keys(parsed).length).toBe(2);
                expect(parsed["tx1"]).toBeDefined();
                expect(parsed["tx2"]).toBeDefined();
            }
        });
    });

    describe("cleanUpTransaction", () => {
        beforeEach(() => {
            // Add some test transactions
            listener.saveUpTransaction("tx1", "fission", { erg: "1000000000", gau: "0", gauc: "0", timestamp: Date.now() }, { erg: "-500000000", gau: "250000000", gauc: "250000000", fees: "-1000000" });
            listener.saveUpTransaction("tx2", "fusion", { erg: "1000000000", gau: "500000000", gauc: "500000000", timestamp: Date.now() }, { erg: "1000000000", gau: "-500000000", gauc: "-500000000", fees: "-1000000" });
        });

        test("should remove specific transaction", () => {
            listener.cleanUpTransaction("tx1");

            const stored = localStorage.getItem("gluon_pending_transactions");
            if (stored) {
                const parsed = JSON.parse(stored);
                expect(parsed["tx1"]).toBeUndefined();
                expect(parsed["tx2"]).toBeDefined();
            }
        });

        test("should remove all old completed transactions", () => {
            // Manually update localStorage with old transaction
            const stored = localStorage.getItem("gluon_pending_transactions");
            if (stored) {
                const pending = JSON.parse(stored);
                pending["tx1"].timestamp = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
                pending["tx1"].isWalletUpdated = true;
                localStorage.setItem("gluon_pending_transactions", JSON.stringify(pending));

                listener.cleanUpTransaction();

                const updatedStored = localStorage.getItem("gluon_pending_transactions");
                if (updatedStored) {
                    const parsed = JSON.parse(updatedStored);
                    expect(parsed["tx1"]).toBeUndefined();
                    expect(parsed["tx2"]).toBeDefined();
                }
            }
        });

        test("should clear localStorage when no transactions remain", () => {
            listener.cleanUpTransaction("tx1");
            listener.cleanUpTransaction("tx2");

            const stored = localStorage.getItem("gluon_pending_transactions");
            if (stored) {
                const parsed = JSON.parse(stored);
                expect(Object.keys(parsed).length).toBe(0);
            }
        });
    });

    describe("hasPendingTransactions", () => {
        test("should return false when no pending transactions", () => {
            expect(listener.hasPendingTransactions()).toBe(false);
        });

        test("should return true when pending transactions exist", () => {
            listener.saveUpTransaction("tx1", "fission", { erg: "1000000000", gau: "0", gauc: "0", timestamp: Date.now() }, { erg: "-500000000", gau: "250000000", gauc: "250000000", fees: "-1000000" });
            expect(listener.hasPendingTransactions()).toBe(true);
        });
    });

    describe("getPendingTransactionsList", () => {
        test("should return empty array when no transactions", () => {
            const list = listener.getPendingTransactionsList();
            expect(list).toEqual([]);
        });

        test("should return array of pending transactions", () => {
            listener.saveUpTransaction("tx1", "fission", { erg: "1000000000", gau: "0", gauc: "0", timestamp: Date.now() }, { erg: "-500000000", gau: "250000000", gauc: "250000000", fees: "-1000000" });
            listener.saveUpTransaction("tx2", "fusion", { erg: "1000000000", gau: "500000000", gauc: "500000000", timestamp: Date.now() }, { erg: "1000000000", gau: "-500000000", gauc: "-500000000", fees: "-1000000" });

            const list = listener.getPendingTransactionsList();
            expect(list.length).toBe(2);
            expect(list[0].txHash).toBeDefined();
            expect(list[1].txHash).toBeDefined();
        });
    });

    describe("initialize", () => {
        test("should not start listening when no pending transactions", () => {
            listener.initialize();
            expect(listener.hasPendingTransactions()).toBe(false);
        });

        test("should start listening when pending transactions exist", () => {
            listener.saveUpTransaction("tx1", "fission", { erg: "1000000000", gau: "0", gauc: "0", timestamp: Date.now() }, { erg: "-500000000", gau: "250000000", gauc: "250000000", fees: "-1000000" });

            // Create new listener to test initialization
            const newListener = new TransactionListener(mockNodeService as NodeService);
            newListener.initialize();

            expect(newListener.hasPendingTransactions()).toBe(true);
        });
    });
});
