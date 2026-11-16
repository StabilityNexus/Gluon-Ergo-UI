import { describe, it, expect } from "bun:test";
import { resolveAssetPath } from "./asset-path";

describe("resolveAssetPath", () => {
  it("returns the path as-is for absolute URLs", () => {
    expect(resolveAssetPath("https://example.com/image.png")).toBe("https://example.com/image.png");
  });

  it("returns the path as-is for http URLs", () => {
    expect(resolveAssetPath("http://example.com/image.png")).toBe("http://example.com/image.png");
  });

  it("normalizes paths without leading slash", () => {
    expect(resolveAssetPath("images/logo.png")).toBe("/images/logo.png");
  });

  it("prepends basePath when provided", () => {
    expect(resolveAssetPath("logo.png", "/assets")).toBe("/assets/logo.png");
  });

  it("handles empty path", () => {
    expect(resolveAssetPath("")).toBe("");
  });

  it("does not double-slash when basePath already contains leading slash", () => {
    expect(resolveAssetPath("/logo.png", "/base")).toBe("/base/logo.png");
  });
});
