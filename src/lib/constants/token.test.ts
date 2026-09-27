import { describe, it, expect, beforeAll } from "bun:test";
import { ACTION_TYPES, TOKEN_ADDRESS } from "./token";

describe("TOKEN_ADDRESS", () => {
  it("has 9 decimals", () => {
    expect(TOKEN_ADDRESS.decimals).toBe(9);
  });

  it("has stable asset address", () => {
    expect(TOKEN_ADDRESS.stableAsset).toBeTruthy();
    expect(TOKEN_ADDRESS.stableAsset.length).toBe(64);
  });

  it("has volatile asset address", () => {
    expect(TOKEN_ADDRESS.volatileAsset).toBeTruthy();
    expect(TOKEN_ADDRESS.volatileAsset.length).toBe(64);
  });
});

describe("ACTION_TYPES", () => {
  it("defines FISSION action", () => {
    expect(ACTION_TYPES.FISSION).toBe("fission");
  });

  it("defines FUSION action", () => {
    expect(ACTION_TYPES.FUSION).toBe("fusion");
  });

  it("defines TRANSMUTE_TO_PEG action", () => {
    expect(ACTION_TYPES.TRANSMUTE_TO_PEG).toMatch(/^transmute-to-/);
  });

  it("defines TRANSMUTE_FROM_PEG action", () => {
    expect(ACTION_TYPES.TRANSMUTE_FROM_PEG).toMatch(/^transmute-from-/);
  });

  it("has unique action type values", () => {
    const values = Object.values(ACTION_TYPES);
    expect(new Set(values).size).toBe(values.length);
  });
});
