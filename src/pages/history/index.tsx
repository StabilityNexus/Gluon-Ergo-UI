/**
 * Transaction History Page
 * Displays complete transaction history with filtering
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { getDBInstance, TransactionRecord } from "@/lib/utils/indexed-db";
import { TransactionCard } from "@/lib/components/blocks/TransactionCard";
import { initializeTransactionSync } from "@/lib/utils/transaction-sync";
import { exportTransactionsToCSV, exportTransactionsToJSON } from "@/lib/utils/export-utils";
import { Button } from "@/lib/components/ui/button";
import { Download, RefreshCw, Wallet } from "lucide-react";
import { SEO } from "@/lib/components/layout/SEO";
import { useErgo } from "@/lib/providers/ErgoProvider";
import { WalletConnector } from "@/lib/components/blockchain/connector/WalletConnector";

const PAGE_SIZE = 20; // Number of transactions per page

export default function TransactionHistory() {
  const { isConnected, getChangeAddress } = useErgo();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TransactionRecord["status"] | "all">("all");
  const [typeFilter, setTypeFilter] = useState<TransactionRecord["actionType"] | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [walletAddress, setWalletAddress] = useState<string>("");

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const db = getDBInstance();
      await db.init();

      const allTx = await db.getAllTransactions();
      // Sort by timestamp descending (newest first)
      const sorted = allTx.sort((a, b) => b.timestamp - a.timestamp);
      setTransactions(sorted);
    } catch (error) {
      console.error("Failed to load transactions:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch wallet address when connected
    if (isConnected) {
      getChangeAddress()
        .then((address) => setWalletAddress(address))
        .catch((error) => console.error("Failed to get wallet address:", error));
    } else {
      setWalletAddress("");
    }
  }, [isConnected, getChangeAddress]);

  useEffect(() => {
    // Initialize sync and load transactions only when wallet is connected
    if (!isConnected) {
      setLoading(false);
      setTransactions([]);
      return;
    }

    const init = async () => {
      await initializeTransactionSync();
      await loadTransactions();
    };
    init();
  }, [isConnected, loadTransactions]);

  const filteredTransactions = transactions
    .filter((tx) => filter === "all" || tx.status === filter)
    .filter((tx) => typeFilter === "all" || tx.actionType === typeFilter);

  // Memoize transaction counts to avoid recalculating on every render
  const transactionCounts = useMemo(
    () => ({
      all: transactions.length,
      pending: transactions.filter((tx) => tx.status === "pending").length,
      confirmed: transactions.filter((tx) => tx.status === "confirmed").length,
      timeout: transactions.filter((tx) => tx.status === "timeout").length,
    }),
    [transactions]
  );

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, typeFilter]);

  const handleExportCSV = () => {
    exportTransactionsToCSV(filteredTransactions);
  };

  const handleExportJSON = () => {
    exportTransactionsToJSON(filteredTransactions);
  };

  return (
    <>
      <SEO title="Transaction History - Gluon" description="View your complete transaction history for Gluon protocol" />
      <main className="container mx-auto min-h-screen px-4 py-4 md:py-8">
        <div className="mx-auto max-w-4xl w-full">
          <div className="mb-4 md:mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold">Transaction History</h1>
              {isConnected && walletAddress && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wallet className="h-4 w-4" />
                  <code className="text-xs">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </code>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadTransactions}>
                <RefreshCw className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Refresh</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">CSV</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportJSON}>
                <Download className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">JSON</span>
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-4 md:mb-6 space-y-3">
            {/* Status Filter */}
            <div className="flex flex-wrap gap-2">
              <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
                All ({transactionCounts.all})
              </Button>
              <Button variant={filter === "pending" ? "default" : "outline"} size="sm" onClick={() => setFilter("pending")}>
                Pending ({transactionCounts.pending})
              </Button>
              <Button variant={filter === "confirmed" ? "default" : "outline"} size="sm" onClick={() => setFilter("confirmed")}>
                Confirmed ({transactionCounts.confirmed})
              </Button>
              <Button variant={filter === "timeout" ? "default" : "outline"} size="sm" onClick={() => setFilter("timeout")}>
                Timeout ({transactionCounts.timeout})
              </Button>
            </div>
            
            {/* Type Filter */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground self-center mr-2 hidden md:inline">Type:</span>
              <Button variant={typeFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setTypeFilter("all")}>
                All Types
              </Button>
              <Button variant={typeFilter === "fission" ? "default" : "outline"} size="sm" onClick={() => setTypeFilter("fission")}>
                Fission
              </Button>
              <Button variant={typeFilter === "fusion" ? "default" : "outline"} size="sm" onClick={() => setTypeFilter("fusion")}>
                Fusion
              </Button>
              <Button variant={typeFilter === "transmute-to-gold" ? "default" : "outline"} size="sm" onClick={() => setTypeFilter("transmute-to-gold")}>
                To Gold
              </Button>
              <Button variant={typeFilter === "transmute-from-gold" ? "default" : "outline"} size="sm" onClick={() => setTypeFilter("transmute-from-gold")}>
                From Gold
              </Button>
            </div>
          </div>

          {/* Transaction List */}
          {!isConnected ? (
            <div className="py-12 text-center">
              <Wallet className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="mb-4 text-lg font-medium">Connect your wallet to view transaction history</p>
              <p className="mb-6 text-sm text-muted-foreground">
                Your transaction history is tied to your wallet address.
                <br />
                Connect to see all your past transactions.
              </p>
              <WalletConnector />
            </div>
          ) : loading ? (
            <div className="py-12 text-center">
              <RefreshCw className="mx-auto mb-4 h-8 w-8 animate-spin" />
              <p className="text-muted-foreground">Loading transactions...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No transactions found</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {paginatedTransactions.map((tx) => (
                  <TransactionCard key={tx.id} transaction={tx} />
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t pt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredTransactions.length)} of{" "}
                    {filteredTransactions.length} transactions
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
