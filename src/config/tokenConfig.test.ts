import { describe, it, expect, beforeAll } from "bun:test";
import { formatPegAsset, getStableAssetSymbol, getVolatileAssetSymbol, getBaseAssetSymbol } from "./tokenConfig";

describe("tokenConfig helpers", () => {
  it("getStableAssetSymbol returns a string", () => {
    expect(typeof getStableAssetSymbol()).toBe("string");
    expect(getStableAssetSymbol().length).toBeGreaterThan(0);
  });

  it("getVolatileAssetSymbol returns a string", () => {
    expect(typeof getVolatileAssetSymbol()).toBe("string");
    expect(getVolatileAssetSymbol().length).toBeGreaterThan(0);
  });

  it("getBaseAssetSymbol returns ERG", () => {
    expect(getBaseAssetSymbol()).toBe("ERG");
  });

  it("formatPegAsset returns a formatted string", () => {
    const result = formatPegAsset();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
