/**
 * @file seo-urls.ts
 * @description Helper functions to construct canonical and social URLs for SEO meta tags.
 * @module lib/utils
 */
import { resolveAssetPath } from "./asset-path";

/**
 * Resolves the canonical/page URL for SEO meta tags (canonical, og:url, twitter:url).
 * Normalizes slashes, strips queries and hash fragments, prepends basePath,
 * and ensures a trailing slash (consistent with trailingSlash: true in next.config.ts).
 * Returns undefined if siteUrl is unset or empty.
 *
 * @param path - Current route path (e.g. "/" or "/history" or "/swap?token=gold#top")
 * @param siteUrl - Configured site URL (e.g. "https://gold.ergo.gluon.stability.nexus/")
 * @param basePath - Optional subpath/basePath (e.g. "/repo")
 * @returns Fully qualified canonical URL or undefined if siteUrl is unset
 */
export function resolveSeoPageUrl(
  path: string,
  siteUrl?: string,
  basePath?: string
): string | undefined {
  if (!siteUrl || !siteUrl.trim()) {
    return undefined;
  }

  // If path is already an absolute HTTP(S) URL, normalize and return
  if (path.startsWith("http://") || path.startsWith("https://")) {
    const withoutQuery = path.split(/[?#]/)[0];
    return withoutQuery.endsWith("/") ? withoutQuery : `${withoutQuery}/`;
  }

  const base = siteUrl.trim().replace(/\/+$/, "");
  const cleanBase = basePath ? basePath.replace(/^\/+|\/+$/g, "") : "";
  const pathWithoutQuery = path.split(/[?#]/)[0];
  const cleanPath = pathWithoutQuery.replace(/^\/+|\/+$/g, "");

  const segments = [cleanBase, cleanPath].filter(Boolean);
  if (segments.length === 0) {
    return `${base}/`;
  }

  return `${base}/${segments.join("/")}/`;
}

/**
 * Resolves the absolute URL for social share images (og:image, twitter:image).
 * Returns undefined if siteUrl is unset or image is empty (social crawlers require absolute URLs).
 * If the image path is already absolute (http:// or https://), returns it unchanged.
 *
 * @param image - Image path or URL (e.g. "/logo/gluon.png" or "https://...")
 * @param siteUrl - Configured site URL (e.g. "https://gold.ergo.gluon.stability.nexus/")
 * @param basePath - Optional subpath/basePath (e.g. "/repo")
 * @returns Fully qualified image URL or undefined
 */
export function resolveSeoImageUrl(
  image?: string,
  siteUrl?: string,
  basePath?: string
): string | undefined {
  if (!image || !image.trim()) {
    return undefined;
  }

  // If already absolute URL, return directly
  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }

  if (!siteUrl || !siteUrl.trim()) {
    return undefined;
  }

  const base = siteUrl.trim().replace(/\/+$/, "");
  const assetPath = resolveAssetPath(image, basePath);
  const normalizedAssetPath = assetPath.startsWith("/") ? assetPath : `/${assetPath}`;

  return `${base}${normalizedAssetPath}`;
}
