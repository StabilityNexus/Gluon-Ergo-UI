/**
 * @file network.test.ts
 * @description Unit tests for pure mainnet address validation helper.
 * @module test
 */

import { describe, it, expect } from "bun:test";
import { isMainnetAddress } from "@/lib/functions/reactor/network";

describe("network.ts isMainnetAddress", () => {
  it("returns true for mainnet P2PK addresses starting with '9'", () => {
    expect(isMainnetAddress("9f4QF8AD1nQ3nJahQVkMj8hFSVVzVom77b52JU7EW71Zexg6N8v")).toBe(true);
    expect(isMainnetAddress("  9f4QF8AD1nQ3nJahQVkMj8hFSVVzVom77b52JU7EW71Zexg6N8v  ")).toBe(true);
  });

  it("returns false for testnet addresses starting with '3'", () => {
    expect(isMainnetAddress("3WvsT2Gm4EpsM9Pg18PdY6XyhNNMqXDsvJTbbf6ihLvAmSb7u5RN")).toBe(false);
    expect(isMainnetAddress("3")).toBe(false);
  });

  it("returns false for empty, whitespace, or undefined values", () => {
    expect(isMainnetAddress("")).toBe(false);
    expect(isMainnetAddress("   ")).toBe(false);
    expect(isMainnetAddress(undefined)).toBe(false);
  });
});

