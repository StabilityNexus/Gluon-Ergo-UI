import { describe, it, expect } from "bun:test";
import { exportToCSV, exportToJSON } from "./export-utils";
import type { TransactionRecord } from "./indexed-db";

const mockTransactions: TransactionRecord[] = [
  {
    id: "abc123",
    timestamp: 1700000000000,
    actionType: "fission",
    status: "confirmed",
    preState: { erg: "1000000000", gau: "0", gauc: "0" },
    expectedChanges: { erg: "-500000000", gau: "1000000000", gauc: "0", fees: "-1000000" },
    confirmationHeight: 1000,
    retryCount: 0,
  },
  {
    id: "def456",
    timestamp: 1700001000000,
    actionType: "fusion",
    status: "pending",
    preState: { erg: "500000000", gau: "1000000000", gauc: "0" },
    expectedChanges: { erg: "500000000", gau: "-1000000000", gauc: "500000000", fees: "-1000000" },
    retryCount: 1,
  },
];

describe("exportToCSV", () => {
  it("generates CSV with headers", () => {
    const csv = exportToCSV(mockTransactions);
    expect(csv).toContain("Transaction Hash");
    expect(csv).toContain("ERG Change");
    expect(csv).toContain("Fees (ERG)");
  });

  it("includes transaction data in CSV", () => {
    const csv = exportToCSV(mockTransactions);
    expect(csv).toContain("abc123");
    expect(csv).toContain("def456");
    expect(csv).toContain("fission");
    expect(csv).toContain("fusion");
  });

  it("formats fee without negative sign", () => {
    const csv = exportToCSV(mockTransactions);
    expect(csv).toContain("0.001");
    expect(csv).not.toContain("-0.001");
  });
});

describe("exportToJSON", () => {
  it("returns valid JSON string", () => {
    const json = exportToJSON(mockTransactions);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
  });

  it("includes all transaction data", () => {
    const json = exportToJSON(mockTransactions);
    const parsed = JSON.parse(json);
    expect(parsed[0].id).toBe("abc123");
    expect(parsed[1].id).toBe("def456");
  });

  it("handles empty array", () => {
    const json = exportToJSON([]);
    expect(JSON.parse(json)).toEqual([]);
  });
});
