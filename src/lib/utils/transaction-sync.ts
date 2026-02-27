/**
 * Bridge service to sync transaction data between localStorage and IndexedDB
 * This allows gradual migration while maintaining backward compatibility
 */

import { getDBInstance, TransactionRecord } from "./indexed-db";
import { TransactionState } from "./transaction-listener";

const LOCALSTORAGE_KEY = "gluon_pending_transactions";

/**
 * Sync localStorage transaction data to IndexedDB
 */
export const syncTransactionsToIndexedDB = async (): Promise<void> => {
  try {
    const db = getDBInstance();
    await db.init();

    // Get data from localStorage
    const stored = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!stored) {
      console.log("ℹ️ No transactions to sync");
      return;
    }

    const pendingTransactions = JSON.parse(stored) as Record<string, TransactionState>;
    let syncedCount = 0;

    for (const [txHash, txState] of Object.entries(pendingTransactions)) {
      // Check if already exists in IndexedDB
      const existing = await db.getTransaction(txHash);
      if (existing) {
        // Update if status changed
        if (
          (txState.isConfirmed && existing.status !== "confirmed") ||
          (txState.isWalletUpdated && existing.status !== "confirmed")
        ) {
          await db.updateTransactionStatus(txHash, "confirmed", {
            confirmationHeight: txState.confirmationHeight,
            confirmationTime: Date.now(),
            postState: {
              erg: "0", // Will be updated when wallet updates
              gau: "0",
              gauc: "0",
            },
          });
          syncedCount++;
        }
        continue;
      }

      // Convert old format to new format
      const record: TransactionRecord = {
        id: txHash,
        timestamp: txState.timestamp,
        actionType: txState.actionType as TransactionRecord["actionType"],
        status: txState.isWalletUpdated
          ? "confirmed"
          : txState.isConfirmed
            ? "confirmed"
            : "pending",
        preState: txState.preTransactionState,
        expectedChanges: txState.expectedChanges,
        confirmationHeight: txState.confirmationHeight,
        confirmationTime: txState.isConfirmed ? Date.now() : undefined,
        retryCount: txState.retryCount || 0,
      };

      await db.saveTransaction(record);
      syncedCount++;
    }

    if (syncedCount > 0) {
      console.log(`✅ Synced ${syncedCount} transactions to IndexedDB`);
    }
  } catch (error) {
    console.error("Failed to sync transactions to IndexedDB:", error);
  }
};

/**
 * Initialize sync - run on app startup
 */
export const initializeTransactionSync = async (): Promise<void> => {
  const db = getDBInstance();
  await db.init();

  // Initial migration from localStorage
  await db.migrateFromLocalStorage(LOCALSTORAGE_KEY);

  // Set up periodic sync (every 30 seconds)
  setInterval(async () => {
    await syncTransactionsToIndexedDB();
  }, 30000);

  console.log("✅ Transaction sync initialized");
};

/**
 * Manually trigger sync
 */
export const manualSync = async (): Promise<void> => {
  await syncTransactionsToIndexedDB();
};
