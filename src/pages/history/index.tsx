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
import { Download, RefreshCw } from "lucide-react";
import { SEO } from "@/lib/components/layout/SEO";

const PAGE_SIZE = 20; // Number of transactions per page

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TransactionRecord["status"] | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);

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
    // Initialize sync and load transactions
    const init = async () => {
      await initializeTransactionSync();
      await loadTransactions();
    };
    init();
  }, [loadTransactions]);

  const filteredTransactions = filter === "all" ? transactions : transactions.filter((tx) => tx.status === filter);

  // Memoize transaction counts to avoid recalculating on every render
  const transactionCounts = useMemo(
    () => ({
      all: transactions.length,
      pending: transactions.filter((tx) => tx.status === "pending").length,
      confirmed: transactions.filter((tx) => tx.status === "confirmed").length,
      failed: transactions.filter((tx) => tx.status === "failed").length,
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
  }, [filter]);

  const handleExportCSV = () => {
    exportTransactionsToCSV(filteredTransactions);
  };

  const handleExportJSON = () => {
    exportTransactionsToJSON(filteredTransactions);
  };

  return (
    <>
      <SEO title="Transaction History - Gluon" description="View your complete transaction history for Gluon protocol" />
      <main className="container mx-auto min-h-screen px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold">Transaction History</h1>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadTransactions}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportJSON}>
                <Download className="mr-2 h-4 w-4" />
                JSON
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 flex gap-2">
            <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
              All ({transactionCounts.all})
            </Button>
            <Button variant={filter === "pending" ? "default" : "outline"} size="sm" onClick={() => setFilter("pending")}>
              Pending ({transactionCounts.pending})
            </Button>
            <Button variant={filter === "confirmed" ? "default" : "outline"} size="sm" onClick={() => setFilter("confirmed")}>
              Confirmed ({transactionCounts.confirmed})
            </Button>
            <Button variant={filter === "failed" ? "default" : "outline"} size="sm" onClick={() => setFilter("failed")}>
              Failed ({transactionCounts.failed})
            </Button>
          </div>

          {/* Transaction List */}
          {loading ? (
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
