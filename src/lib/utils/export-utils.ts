/**
 * Data export utilities for transaction history
 */

import { TransactionRecord } from "./indexed-db";
import { nanoErgsToErgs } from "./erg-converter";

/**
 * Convert transactions to CSV format
 */
export const exportToCSV = (transactions: TransactionRecord[]): string => {
  // CSV headers
  const headers = ["Transaction Hash", "Timestamp", "Date", "Action Type", "Status", "ERG Change", "GAU Change", "GAUC Change", "Fees (ERG)", "Block Height", "Confirmation Time"];

  // CSV rows
  const rows = transactions.map((tx) => {
    const date = new Date(tx.timestamp).toISOString();
    const ergChange = nanoErgsToErgs(tx.expectedChanges.erg).toString();
    const gauChange = nanoErgsToErgs(tx.expectedChanges.gau).toString();
    const gaucChange = nanoErgsToErgs(tx.expectedChanges.gauc).toString();
    const fees = nanoErgsToErgs(tx.expectedChanges.fees.replace("-", "")).toString();
    const confirmationTime = tx.confirmationTime ? new Date(tx.confirmationTime).toISOString() : "";

    return [tx.id, tx.timestamp, date, tx.actionType, tx.status, ergChange, gauChange, gaucChange, fees, tx.confirmationHeight || "", confirmationTime];
  });

  // Combine headers and rows
  const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");

  return csvContent;
};

/**
 * Convert transactions to JSON format
 */
export const exportToJSON = (transactions: TransactionRecord[]): string => {
  return JSON.stringify(transactions, null, 2);
};

/**
 * Trigger browser download
 */
export const downloadFile = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export transactions to CSV file
 */
export const exportTransactionsToCSV = (transactions: TransactionRecord[]): void => {
  const csv = exportToCSV(transactions);
  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `gluon-transactions-${timestamp}.csv`;
  downloadFile(csv, filename, "text/csv");
};

/**
 * Export transactions to JSON file
 */
export const exportTransactionsToJSON = (transactions: TransactionRecord[]): void => {
  const json = exportToJSON(transactions);
  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `gluon-transactions-${timestamp}.json`;
  downloadFile(json, filename, "application/json");
};
