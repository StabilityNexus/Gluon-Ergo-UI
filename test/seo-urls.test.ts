/**
 * @file seo-urls.test.ts
 * @description Unit tests for SEO URL resolution and normalization.
 * @module test
 */
import { describe, it, expect } from "bun:test";
import { resolveSeoPageUrl, resolveSeoImageUrl } from "@/lib/utils/seo-urls";

describe("resolveSeoPageUrl", () => {
  it("returns undefined when siteUrl is unset or empty", () => {
    expect(resolveSeoPageUrl("/")).toBeUndefined();
    expect(resolveSeoPageUrl("/", "")).toBeUndefined();
    expect(resolveSeoPageUrl("/history", "   ")).toBeUndefined();
  });

  it("handles siteUrl with or without trailing slash identically", () => {
    const withSlash = "https://gold.ergo.gluon.stability.nexus/";
    const withoutSlash = "https://gold.ergo.gluon.stability.nexus";

    expect(resolveSeoPageUrl("/", withSlash)).toBe("https://gold.ergo.gluon.stability.nexus/");
    expect(resolveSeoPageUrl("/", withoutSlash)).toBe("https://gold.ergo.gluon.stability.nexus/");

    expect(resolveSeoPageUrl("/history", withSlash)).toBe("https://gold.ergo.gluon.stability.nexus/history/");
    expect(resolveSeoPageUrl("/history", withoutSlash)).toBe("https://gold.ergo.gluon.stability.nexus/history/");
  });

  it("handles basePath correctly without double slashes", () => {
    const siteUrl = "https://gold.ergo.gluon.stability.nexus/";
    const basePath = "/repo";

    expect(resolveSeoPageUrl("/", siteUrl, basePath)).toBe("https://gold.ergo.gluon.stability.nexus/repo/");
    expect(resolveSeoPageUrl("/history", siteUrl, basePath)).toBe("https://gold.ergo.gluon.stability.nexus/repo/history/");
  });

  it("normalizes nested routes and strips query and hash parameters", () => {
    const siteUrl = "https://gold.ergo.gluon.stability.nexus";

    expect(resolveSeoPageUrl("/reactor/history?filter=all#top", siteUrl)).toBe(
      "https://gold.ergo.gluon.stability.nexus/reactor/history/"
    );
    expect(resolveSeoPageUrl("/a/b/c/", siteUrl)).toBe(
      "https://gold.ergo.gluon.stability.nexus/a/b/c/"
    );
  });

  it("normalizes already-absolute page URLs", () => {
    expect(resolveSeoPageUrl("https://example.com/custom?x=1", "https://other.com")).toBe(
      "https://example.com/custom/"
    );
  });
});

describe("resolveSeoImageUrl", () => {
  it("returns undefined when siteUrl is unset and image is a relative path", () => {
    expect(resolveSeoImageUrl("/logo/gluon.png", "")).toBeUndefined();
    expect(resolveSeoImageUrl("/logo/gluon.png", undefined)).toBeUndefined();
    expect(resolveSeoImageUrl(undefined, "https://gold.ergo.gluon.stability.nexus/")).toBeUndefined();
  });

  it("preserves already-absolute image URLs regardless of siteUrl", () => {
    const absoluteImage = "https://cdn.example.com/images/banner.png";
    expect(resolveSeoImageUrl(absoluteImage, "")).toBe(absoluteImage);
    expect(resolveSeoImageUrl(absoluteImage, "https://gold.ergo.gluon.stability.nexus/")).toBe(absoluteImage);
  });

  it("builds absolute image URLs combining siteUrl, basePath, and asset path", () => {
    const siteUrl = "https://gold.ergo.gluon.stability.nexus/";
    expect(resolveSeoImageUrl("/logo/gluon.png", siteUrl)).toBe(
      "https://gold.ergo.gluon.stability.nexus/logo/gluon.png"
    );

    const basePath = "/repo";
    expect(resolveSeoImageUrl("/logo/gluon.png", siteUrl, basePath)).toBe(
      "https://gold.ergo.gluon.stability.nexus/repo/logo/gluon.png"
    );
  });
});
