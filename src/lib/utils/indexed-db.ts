/**
 * IndexedDB service for transaction history storage
 * Provides a robust local storage solution with querying and analytics support
 */

// Database configuration
const DB_NAME = "gluon-transactions";
const DB_VERSION = 1;
const STORE_NAME = "transactions";

// Transaction record interface
export interface TransactionRecord {
  id: string; // txHash
  timestamp: number;
  blockHeight?: number;
  actionType: "fission" | "fusion" | "transmute-to-gold" | "transmute-from-gold";
  status: "pending" | "confirmed" | "failed" | "timeout";

  // Balance changes
  preState: {
    erg: string;
    gau: string;
    gauc: string;
  };
  postState?: {
    erg: string;
    gau: string;
    gauc: string;
  };
  expectedChanges: {
    erg: string;
    gau: string;
    gauc: string;
    fees: string;
  };

  // Metadata
  confirmationHeight?: number;
  confirmationTime?: number;
  retryCount: number;
  errorMessage?: string;
}

// Query options
export interface QueryOptions {
  actionType?: TransactionRecord["actionType"];
  status?: TransactionRecord["status"];
  startDate?: number;
  endDate?: number;
  limit?: number;
  offset?: number;
  sortOrder?: "asc" | "desc";
}

// Analytics data structures
export interface TransactionStats {
  total: number;
  confirmed: number;
  pending: number;
  failed: number;
  byType: Record<string, number>;
  averageConfirmationTime: number;
  totalFees: string;
}

export class IndexedDBService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    // Return existing init promise if already initializing
    if (this.initPromise) {
      return this.initPromise;
    }

    // Return immediately if already initialized
    if (this.db) {
      return Promise.resolve();
    }

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof window === "undefined" || !window.indexedDB) {
        reject(new Error("IndexedDB is not supported in this environment"));
        return;
      }

      console.log("🗄️ Initializing IndexedDB...");
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("Failed to open IndexedDB:", request.error);
        this.initPromise = null;
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log("✅ IndexedDB initialized successfully");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log("🔧 Upgrading IndexedDB schema...");

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: "id" });

          // Create indexes for efficient querying
          objectStore.createIndex("timestamp", "timestamp", { unique: false });
          objectStore.createIndex("actionType", "actionType", { unique: false });
          objectStore.createIndex("status", "status", { unique: false });
          objectStore.createIndex("actionType_timestamp", ["actionType", "timestamp"], { unique: false });

          console.log("✅ Object store and indexes created");
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Add or update a transaction
   */
  async saveTransaction(transaction: TransactionRecord): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(transaction);

      request.onsuccess = () => {
        console.log("💾 Transaction saved:", transaction.id.slice(0, 8) + "...");
        resolve();
      };

      request.onerror = () => {
        console.error("Failed to save transaction:", request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get a transaction by ID (txHash)
   */
  async getTransaction(txHash: string): Promise<TransactionRecord | null> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(txHash);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Query transactions with filters
   */
  async queryTransactions(options: QueryOptions = {}): Promise<TransactionRecord[]> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], "readonly");
      const store = tx.objectStore(STORE_NAME);
      const results: TransactionRecord[] = [];

      // Use appropriate index if available
      let cursorSource: IDBObjectStore | IDBIndex = store;
      let range: IDBKeyRange | undefined;

      if (options.actionType && options.startDate) {
        // Use compound index for actionType + timestamp
        cursorSource = store.index("actionType_timestamp");
        const lower = [options.actionType, options.startDate];
        const upper = [options.actionType, options.endDate || Date.now()];
        range = IDBKeyRange.bound(lower, upper);
      } else if (options.actionType) {
        cursorSource = store.index("actionType");
        range = IDBKeyRange.only(options.actionType);
      } else if (options.status) {
        cursorSource = store.index("status");
        range = IDBKeyRange.only(options.status);
      } else if (options.startDate) {
        cursorSource = store.index("timestamp");
        range = IDBKeyRange.bound(options.startDate, options.endDate || Date.now());
      }

      const request = cursorSource.openCursor(range, options.sortOrder === "asc" ? "next" : "prev");

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (cursor) {
          const record = cursor.value as TransactionRecord;

          // Apply additional filters
          let matchesFilters = true;

          if (options.status && record.status !== options.status) {
            matchesFilters = false;
          }

          if (options.startDate && record.timestamp < options.startDate) {
            matchesFilters = false;
          }

          if (options.endDate && record.timestamp > options.endDate) {
            matchesFilters = false;
          }

          if (matchesFilters) {
            results.push(record);
          }

          // Check limit and offset
          if (options.limit && results.length >= (options.offset || 0) + options.limit) {
            resolve(results.slice(options.offset || 0, (options.offset || 0) + options.limit));
            return;
          }

          cursor.continue();
        } else {
          // No more results
          resolve(results.slice(options.offset || 0));
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get all transactions (use with caution for large datasets)
   */
  async getAllTransactions(): Promise<TransactionRecord[]> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get pending transactions
   */
  async getPendingTransactions(): Promise<TransactionRecord[]> {
    return this.queryTransactions({ status: "pending" });
  }

  /**
   * Update transaction status
   */
  async updateTransactionStatus(txHash: string, status: TransactionRecord["status"], additionalData?: Partial<TransactionRecord>): Promise<void> {
    const transaction = await this.getTransaction(txHash);
    if (!transaction) {
      throw new Error(`Transaction not found: ${txHash}`);
    }

    const updatedTransaction: TransactionRecord = {
      ...transaction,
      status,
      ...additionalData,
    };

    await this.saveTransaction(updatedTransaction);
  }

  /**
   * Delete a transaction
   */
  async deleteTransaction(txHash: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(txHash);

      request.onsuccess = () => {
        console.log("🗑️ Transaction deleted:", txHash.slice(0, 8) + "...");
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Clear all transactions
   */
  async clearAll(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log("🗑️ All transactions cleared");
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get transaction count
   */
  async getTransactionCount(options: QueryOptions = {}): Promise<number> {
    const transactions = await this.queryTransactions(options);
    return transactions.length;
  }

  /**
   * Get transaction statistics
   */
  async getStats(): Promise<TransactionStats> {
    const allTransactions = await this.getAllTransactions();

    const stats: TransactionStats = {
      total: allTransactions.length,
      confirmed: 0,
      pending: 0,
      failed: 0,
      byType: {
        fission: 0,
        fusion: 0,
        "transmute-to-gold": 0,
        "transmute-from-gold": 0,
      },
      averageConfirmationTime: 0,
      totalFees: "0",
    };

    let totalConfirmationTime = 0;
    let confirmedCount = 0;
    let totalFees = BigInt(0);

    allTransactions.forEach((tx) => {
      // Count by status
      if (tx.status === "confirmed") {
        stats.confirmed++;
        confirmedCount++;
      } else if (tx.status === "pending") {
        stats.pending++;
      } else if (tx.status === "failed" || tx.status === "timeout") {
        stats.failed++;
      }

      // Count by type
      stats.byType[tx.actionType]++;

      // Calculate confirmation time
      if (tx.status === "confirmed" && tx.confirmationTime) {
        totalConfirmationTime += tx.confirmationTime - tx.timestamp;
      }

      // Sum fees
      try {
        const fee = BigInt(tx.expectedChanges.fees.replace("-", ""));
        totalFees += fee;
      } catch (e) {
        // Skip invalid fee values
      }
    });

    stats.averageConfirmationTime = confirmedCount > 0 ? totalConfirmationTime / confirmedCount : 0;
    stats.totalFees = totalFees.toString();

    return stats;
  }

  /**
   * Export all transactions to JSON
   */
  async exportToJSON(): Promise<string> {
    const transactions = await this.getAllTransactions();
    return JSON.stringify(transactions, null, 2);
  }

  /**
   * Import transactions from JSON
   */
  async importFromJSON(jsonData: string): Promise<number> {
    try {
      const transactions = JSON.parse(jsonData) as TransactionRecord[];
      let importedCount = 0;

      for (const tx of transactions) {
        await this.saveTransaction(tx);
        importedCount++;
      }

      console.log(`✅ Imported ${importedCount} transactions`);
      return importedCount;
    } catch (error) {
      console.error("Failed to import transactions:", error);
      throw error;
    }
  }

  /**
   * Migrate data from localStorage
   */
  async migrateFromLocalStorage(localStorageKey: string): Promise<number> {
    try {
      const stored = localStorage.getItem(localStorageKey);
      if (!stored) {
        console.log("ℹ️ No localStorage data to migrate");
        return 0;
      }

      const pendingTransactions = JSON.parse(stored);
      let migratedCount = 0;

      for (const [txHash, txData] of Object.entries(pendingTransactions)) {
        const oldTx = txData as any;

        // Convert old format to new format
        const newTx: TransactionRecord = {
          id: txHash,
          timestamp: oldTx.timestamp,
          actionType: oldTx.actionType,
          status: oldTx.isConfirmed ? "confirmed" : oldTx.isWalletUpdated ? "confirmed" : "pending",
          preState: oldTx.preTransactionState,
          expectedChanges: oldTx.expectedChanges,
          confirmationHeight: oldTx.confirmationHeight,
          retryCount: oldTx.retryCount || 0,
        };

        // Check if transaction already exists
        const existing = await this.getTransaction(txHash);
        if (!existing) {
          await this.saveTransaction(newTx);
          migratedCount++;
        }
      }

      console.log(`✅ Migrated ${migratedCount} transactions from localStorage`);
      return migratedCount;
    } catch (error) {
      console.error("Failed to migrate from localStorage:", error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
      console.log("🔒 Database connection closed");
    }
  }
}

// Export singleton instance
let dbInstance: IndexedDBService | null = null;

export const getDBInstance = (): IndexedDBService => {
  if (!dbInstance) {
    dbInstance = new IndexedDBService();
  }
  return dbInstance;
};
