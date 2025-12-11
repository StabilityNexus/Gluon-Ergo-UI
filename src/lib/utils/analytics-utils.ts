/**
 * Analytics utilities for transaction history
 * Provides data aggregation and calculations for analytics dashboard
 */

import { TransactionRecord, QueryOptions, getDBInstance } from "./indexed-db";

// Time period types
export type TimePeriod = "day" | "week" | "month" | "all";

// Volume data point
export interface VolumeDataPoint {
  timestamp: number;
  date: string;
  count: number;
  fission: number;
  fusion: number;
  "transmute-to-gold": number;
  "transmute-from-gold": number;
}

// Token flow data
export interface TokenFlow {
  actionType: string;
  gauCreated: string;
  gauBurned: string;
  gaucCreated: string;
  gaucBurned: string;
  transactionCount: number;
}

// Success rate data
export interface SuccessRateData {
  actionType: string;
  total: number;
  confirmed: number;
  failed: number;
  pending: number;
  successRate: number;
}

// Confirmation time distribution
export interface ConfirmationTimeDistribution {
  range: string;
  count: number;
}

/**
 * Get date range for time period
 */
export const getDateRangeForPeriod = (period: TimePeriod): { startDate: number; endDate: number } => {
  const now = Date.now();
  const endDate = now;
  let startDate: number;

  switch (period) {
    case "day":
      startDate = now - 24 * 60 * 60 * 1000;
      break;
    case "week":
      startDate = now - 7 * 24 * 60 * 60 * 1000;
      break;
    case "month":
      startDate = now - 30 * 24 * 60 * 60 * 1000;
      break;
    case "all":
      startDate = 0;
      break;
  }

  return { startDate, endDate };
};

/**
 * Get transaction volume by time period
 */
export const getVolumeByPeriod = async (period: TimePeriod, actionType?: TransactionRecord["actionType"]): Promise<VolumeDataPoint[]> => {
  const db = getDBInstance();
  const { startDate, endDate } = getDateRangeForPeriod(period);

  const options: QueryOptions = {
    startDate,
    endDate,
    actionType,
    sortOrder: "asc",
  };

  const transactions = await db.queryTransactions(options);

  // Group by day
  const groupedByDay = new Map<string, VolumeDataPoint>();

  transactions.forEach((tx) => {
    const date = new Date(tx.timestamp);
    const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD

    if (!groupedByDay.has(dateKey)) {
      groupedByDay.set(dateKey, {
        timestamp: date.setHours(0, 0, 0, 0),
        date: dateKey,
        count: 0,
        fission: 0,
        fusion: 0,
        "transmute-to-gold": 0,
        "transmute-from-gold": 0,
      });
    }

    const dataPoint = groupedByDay.get(dateKey)!;
    dataPoint.count++;
    dataPoint[tx.actionType]++;
  });

  return Array.from(groupedByDay.values()).sort((a, b) => a.timestamp - b.timestamp);
};

/**
 * Get token flow analytics - grouped by action type
 */
export const getTokenFlowAnalytics = async (period: TimePeriod): Promise<TokenFlow[]> => {
  const db = getDBInstance();
  const { startDate, endDate } = getDateRangeForPeriod(period);

  const transactions = await db.queryTransactions({
    startDate,
    endDate,
    status: "confirmed", // Only confirmed transactions
    sortOrder: "asc",
  });

  // Group by action type
  const flowByActionType = new Map<TransactionRecord["actionType"], TokenFlow>();

  const actionTypes: TransactionRecord["actionType"][] = ["fission", "fusion", "transmute-to-gold", "transmute-from-gold"];

  // Initialize all action types
  actionTypes.forEach((actionType) => {
    flowByActionType.set(actionType, {
      actionType,
      gauCreated: "0",
      gauBurned: "0",
      gaucCreated: "0",
      gaucBurned: "0",
      transactionCount: 0,
    });
  });

  transactions.forEach((tx) => {
    const flow = flowByActionType.get(tx.actionType)!;
    flow.transactionCount++;

    try {
      const gauChange = BigInt(tx.expectedChanges.gau);
      const gaucChange = BigInt(tx.expectedChanges.gauc);

      // Track creation and burning
      if (gauChange > 0) {
        flow.gauCreated = (BigInt(flow.gauCreated) + gauChange).toString();
      } else if (gauChange < 0) {
        flow.gauBurned = (BigInt(flow.gauBurned) + -gauChange).toString();
      }

      if (gaucChange > 0) {
        flow.gaucCreated = (BigInt(flow.gaucCreated) + gaucChange).toString();
      } else if (gaucChange < 0) {
        flow.gaucBurned = (BigInt(flow.gaucBurned) + -gaucChange).toString();
      }
    } catch (error) {
      console.error("Error calculating token flow for transaction:", tx.id, error);
    }
  });

  return Array.from(flowByActionType.values()).filter((flow) => flow.transactionCount > 0);
};

/**
 * Get success rate by action type
 */
export const getSuccessRate = async (actionType?: TransactionRecord["actionType"]): Promise<SuccessRateData[]> => {
  const db = getDBInstance();
  const allTransactions = await db.getAllTransactions();

  // Filter by action type if specified
  const filtered = actionType ? allTransactions.filter((tx) => tx.actionType === actionType) : allTransactions;

  // Group by action type
  const groupedByType = new Map<string, SuccessRateData>();

  filtered.forEach((tx) => {
    if (!groupedByType.has(tx.actionType)) {
      groupedByType.set(tx.actionType, {
        actionType: tx.actionType,
        total: 0,
        confirmed: 0,
        failed: 0,
        pending: 0,
        successRate: 0,
      });
    }

    const data = groupedByType.get(tx.actionType)!;
    data.total++;

    if (tx.status === "confirmed") {
      data.confirmed++;
    } else if (tx.status === "failed" || tx.status === "timeout") {
      data.failed++;
    } else if (tx.status === "pending") {
      data.pending++;
    }
  });

  // Calculate success rates
  const results = Array.from(groupedByType.values());
  results.forEach((data) => {
    const completed = data.confirmed + data.failed;
    data.successRate = completed > 0 ? (data.confirmed / completed) * 100 : 0;
  });

  return results;
};

/**
 * Get average confirmation time
 */
export const getAverageConfirmationTime = async (): Promise<number> => {
  const db = getDBInstance();
  const confirmedTransactions = await db.queryTransactions({ status: "confirmed" });

  let totalTime = 0;
  let count = 0;

  confirmedTransactions.forEach((tx) => {
    if (tx.confirmationTime) {
      totalTime += tx.confirmationTime - tx.timestamp;
      count++;
    }
  });

  return count > 0 ? totalTime / count : 0;
};

/**
 * Get confirmation time distribution
 */
export const getConfirmationTimeDistribution = async (): Promise<ConfirmationTimeDistribution[]> => {
  const db = getDBInstance();
  const confirmedTransactions = await db.queryTransactions({ status: "confirmed" });

  // Define time buckets (in seconds)
  const buckets = [
    { range: "0-30s", min: 0, max: 30, count: 0 },
    { range: "30s-1m", min: 30, max: 60, count: 0 },
    { range: "1-2m", min: 60, max: 120, count: 0 },
    { range: "2-5m", min: 120, max: 300, count: 0 },
    { range: "5-10m", min: 300, max: 600, count: 0 },
    { range: "10m+", min: 600, max: Infinity, count: 0 },
  ];

  confirmedTransactions.forEach((tx) => {
    if (tx.confirmationTime) {
      const timeInSeconds = (tx.confirmationTime - tx.timestamp) / 1000;

      for (const bucket of buckets) {
        if (timeInSeconds >= bucket.min && timeInSeconds < bucket.max) {
          bucket.count++;
          break;
        }
      }
    }
  });

  return buckets.map((b) => ({ range: b.range, count: b.count }));
};

/**
 * Get transaction summary statistics
 */
export const getTransactionStats = async (dateRange?: { startDate: number; endDate: number }) => {
  const db = getDBInstance();

  const options: QueryOptions = dateRange
    ? {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      }
    : {};

  const transactions = await db.queryTransactions(options);

  const stats = {
    total: transactions.length,
    confirmed: 0,
    pending: 0,
    failed: 0,
    byType: {
      fission: 0,
      fusion: 0,
      "transmute-to-gold": 0,
      "transmute-from-gold": 0,
    },
    totalFees: BigInt(0),
    averageConfirmationTime: 0,
  };

  let totalConfirmationTime = 0;
  let confirmedCount = 0;

  transactions.forEach((tx) => {
    // Count by status
    if (tx.status === "confirmed") {
      stats.confirmed++;
      confirmedCount++;

      if (tx.confirmationTime) {
        totalConfirmationTime += tx.confirmationTime - tx.timestamp;
      }
    } else if (tx.status === "pending") {
      stats.pending++;
    } else if (tx.status === "failed" || tx.status === "timeout") {
      stats.failed++;
    }

    // Count by type
    stats.byType[tx.actionType]++;

    // Sum fees
    try {
      const fee = BigInt(tx.expectedChanges.fees.replace("-", ""));
      stats.totalFees += fee;
    } catch (e) {
      // Skip invalid fee values
    }
  });

  stats.averageConfirmationTime = confirmedCount > 0 ? totalConfirmationTime / confirmedCount : 0;

  return {
    ...stats,
    totalFees: stats.totalFees.toString(),
  };
};

/**
 * Format time duration in human-readable format
 */
export const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

/**
 * Get action type display name
 */
export const getActionTypeLabel = (actionType: TransactionRecord["actionType"]): string => {
  const labels: Record<TransactionRecord["actionType"], string> = {
    fission: "Fission",
    fusion: "Fusion",
    "transmute-to-gold": "Transmute to Gold",
    "transmute-from-gold": "Transmute from Gold",
  };

  return labels[actionType] || actionType;
};

/**
 * Get status color for UI
 */
export const getStatusColor = (status: TransactionRecord["status"]): string => {
  const colors: Record<TransactionRecord["status"], string> = {
    pending: "text-yellow-500",
    confirmed: "text-green-500",
    failed: "text-red-500",
    timeout: "text-orange-500",
  };

  return colors[status] || "text-gray-500";
};

/**
 * Get status badge color for UI
 */
export const getStatusBadgeVariant = (status: TransactionRecord["status"]): "default" | "secondary" | "destructive" | "outline" => {
  const variants: Record<TransactionRecord["status"], "default" | "secondary" | "destructive" | "outline"> = {
    pending: "outline",
    confirmed: "default",
    failed: "destructive",
    timeout: "secondary",
  };

  return variants[status] || "outline";
};
