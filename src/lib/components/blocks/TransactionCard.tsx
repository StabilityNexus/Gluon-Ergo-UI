/**
 * Transaction Card Component
 * Displays individual transaction details
 */

import { TransactionRecord } from "@/lib/utils/indexed-db";
import { nanoErgsToErgs } from "@/lib/utils/erg-converter";
import { Badge } from "@/lib/components/ui/badge";
import { Card, CardContent } from "@/lib/components/ui/card";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

// Inline utility functions (previously from analytics-utils)
const getActionTypeLabel = (actionType: string): string => {
  const labels: Record<string, string> = {
    fission: "Fission",
    fusion: "Fusion",
    "transmute-to-gold": "Transmute to Gold",
    "transmute-from-gold": "Transmute from Gold",
  };
  return labels[actionType] || actionType;
};

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
};

interface TransactionCardProps {
  transaction: TransactionRecord;
}

export const TransactionCard = ({ transaction }: TransactionCardProps) => {
  const handleCopyHash = () => {
    navigator.clipboard.writeText(transaction.id);
    toast.success("Transaction hash copied!");
  };

  const getExplorerUrl = (txHash: string) => {
    const isTestnet = process.env.NEXT_PUBLIC_DEPLOYMENT === "testnet";
    const baseUrl = isTestnet ? "https://testnet.ergoplatform.com" : "https://explorer.ergoplatform.com";
    return `${baseUrl}/en/transactions/${txHash}`;
  };

  const getBadgeVariant = (status: TransactionRecord["status"]) => {
    switch (status) {
      case "confirmed":
        return "default";
      case "pending":
        return "outline";
      case "timeout":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{getActionTypeLabel(transaction.actionType)}</span>
              <Badge variant={getBadgeVariant(transaction.status)}>{transaction.status}</Badge>
            </div>
            <span className="text-sm text-muted-foreground">{new Date(transaction.timestamp).toLocaleString()}</span>
          </div>

          {/* Transaction Hash */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">TX:</span>
            <code className="flex-1 truncate">
              {transaction.id.slice(0, 8)}...{transaction.id.slice(-8)}
            </code>
            <button onClick={handleCopyHash} className="rounded p-1 hover:bg-accent" title="Copy transaction hash">
              <Copy className="h-4 w-4" />
            </button>
            <a href={getExplorerUrl(transaction.id)} target="_blank" rel="noopener noreferrer" className="rounded p-1 hover:bg-accent" title="View in explorer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          {/* Balance Changes */}
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">ERG:</span>
              <span className={`ml-2 ${Number(transaction.expectedChanges.erg) >= 0 ? "text-green-500" : "text-red-500"}`}>
                {Number(transaction.expectedChanges.erg) >= 0 ? "+" : ""}
                {nanoErgsToErgs(transaction.expectedChanges.erg).toString()}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">GAU:</span>
              <span className={`ml-2 ${Number(transaction.expectedChanges.gau) >= 0 ? "text-green-500" : "text-red-500"}`}>
                {Number(transaction.expectedChanges.gau) >= 0 ? "+" : ""}
                {nanoErgsToErgs(transaction.expectedChanges.gau).toString()}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">GAUC:</span>
              <span className={`ml-2 ${Number(transaction.expectedChanges.gauc) >= 0 ? "text-green-500" : "text-red-500"}`}>
                {Number(transaction.expectedChanges.gauc) >= 0 ? "+" : ""}
                {nanoErgsToErgs(transaction.expectedChanges.gauc).toString()}
              </span>
            </div>
          </div>

          {/* Fee */}
          <div className="text-sm">
            <span className="text-muted-foreground">Fee:</span>
            <span className="ml-2">{nanoErgsToErgs(transaction.expectedChanges.fees.replace("-", "")).toString()} ERG</span>
          </div>

          {/* Confirmation Info */}
          {transaction.status === "confirmed" && transaction.confirmationHeight && (
            <div className="text-sm text-muted-foreground">
              Block: {transaction.confirmationHeight}
              {transaction.confirmationTime && <span className="ml-4">Time: {formatDuration(transaction.confirmationTime - transaction.timestamp)}</span>}
            </div>
          )}

          {/* Error Message */}
          {transaction.errorMessage && <div className="text-sm text-destructive">Error: {transaction.errorMessage}</div>}
        </div>
      </CardContent>
    </Card>
  );
};
