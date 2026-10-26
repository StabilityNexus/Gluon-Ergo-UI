/**
 * @file seo-urls.test.ts
 * @description Unit tests for SEO URL resolution and normalization.
 * @module test
 */
import { describe, it, expect } from "bun:test";
import {
  resolveSeoPageUrl,
  resolveSeoImageUrl,
  buildSeoUrls,
} from "@/lib/utils/seo-urls";

describe("resolveSeoPageUrl", () => {
  it("returns undefined when siteUrl is unset, empty, or whitespace", () => {
    expect(resolveSeoPageUrl("/")).toBeUndefined();
    expect(resolveSeoPageUrl("/", "")).toBeUndefined();
    expect(resolveSeoPageUrl("/history", "   ")).toBeUndefined();
  });

  it("normalizes siteUrl with or without trailing slash identically", () => {
    const withSlash = "https://example.org/";
    const withoutSlash = "https://example.org";

    expect(resolveSeoPageUrl("/", withSlash)).toBe("https://example.org/");
    expect(resolveSeoPageUrl("/", withoutSlash)).toBe("https://example.org/");

    expect(resolveSeoPageUrl("/history", withSlash)).toBe("https://example.org/history/");
    expect(resolveSeoPageUrl("/history", withoutSlash)).toBe("https://example.org/history/");
  });

  it("regression test: does not double-apply base path when siteUrl includes subpath", () => {
    const siteUrl = "https://example.org/preview/";

    expect(resolveSeoPageUrl("/", siteUrl)).toBe("https://example.org/preview/");
    expect(resolveSeoPageUrl("/history", siteUrl)).toBe("https://example.org/preview/history/");
    expect(resolveSeoPageUrl("/history/?x=1#y", siteUrl)).toBe("https://example.org/preview/history/");
    expect(resolveSeoImageUrl("/logo/gluon.png", siteUrl)).toBe("https://example.org/preview/logo/gluon.png");
  });

  it("normalizes nested routes, routes without leading slash, and strips query and hash", () => {
    const siteUrl = "https://example.org";

    expect(resolveSeoPageUrl("history", siteUrl)).toBe("https://example.org/history/");
    expect(resolveSeoPageUrl("/a/b", siteUrl)).toBe("https://example.org/a/b/");
    expect(resolveSeoPageUrl("/a/b/?x=1&y=2#top", siteUrl)).toBe("https://example.org/a/b/");
  });

  it("normalizes already-absolute page URLs", () => {
    expect(resolveSeoPageUrl("https://example.org/custom?x=1", "https://other.example.org/")).toBe(
      "https://example.org/custom/"
    );
  });
});

describe("resolveSeoImageUrl", () => {
  it("returns undefined when siteUrl is unset, empty, or whitespace, or image is empty", () => {
    expect(resolveSeoImageUrl("/logo/gluon.png", "")).toBeUndefined();
    expect(resolveSeoImageUrl("/logo/gluon.png", undefined)).toBeUndefined();
    expect(resolveSeoImageUrl("/logo/gluon.png", "   ")).toBeUndefined();
    expect(resolveSeoImageUrl(undefined, "https://example.org/")).toBeUndefined();
    expect(resolveSeoImageUrl("", "https://example.org/")).toBeUndefined();
    expect(resolveSeoImageUrl("   ", "https://example.org/")).toBeUndefined();
  });

  it("preserves already-absolute image URLs regardless of siteUrl", () => {
    const absoluteImage = "https://cdn.example.org/images/banner.png";
    expect(resolveSeoImageUrl(absoluteImage, "")).toBe(absoluteImage);
    expect(resolveSeoImageUrl(absoluteImage, undefined)).toBe(absoluteImage);
    expect(resolveSeoImageUrl(absoluteImage, "https://example.org/")).toBe(absoluteImage);
  });

  it("builds absolute image URLs combining siteUrl and asset path", () => {
    const siteUrl = "https://example.org/";
    expect(resolveSeoImageUrl("/logo/gluon.png", siteUrl)).toBe(
      "https://example.org/logo/gluon.png"
    );
    expect(resolveSeoImageUrl("logo/gluon.png", siteUrl)).toBe(
      "https://example.org/logo/gluon.png"
    );
  });
});

describe("buildSeoUrls", () => {
  it("returns both pageUrl and imageUrl when includePageUrl is true", () => {
    const res = buildSeoUrls({
      path: "/history",
      image: "/logo/gluon.png",
      siteUrl: "https://example.org/preview/",
      includePageUrl: true,
    });
    expect(res.pageUrl).toBe("https://example.org/preview/history/");
    expect(res.imageUrl).toBe("https://example.org/preview/logo/gluon.png");
  });

  it("returns undefined pageUrl but defined imageUrl when includePageUrl is false", () => {
    const res = buildSeoUrls({
      path: "/404",
      image: "/logo/gluon.png",
      siteUrl: "https://example.org/preview/",
      includePageUrl: false,
    });
    expect(res.pageUrl).toBeUndefined();
    expect(res.imageUrl).toBe("https://example.org/preview/logo/gluon.png");
  });

  it("returns undefined for both fields when siteUrl is unset", () => {
    const res = buildSeoUrls({
      path: "/history",
      image: "/logo/gluon.png",
      siteUrl: undefined,
      includePageUrl: true,
    });
    expect(res.pageUrl).toBeUndefined();
    expect(res.imageUrl).toBeUndefined();
  });
});
