/**
 * @file seo-urls.ts
 * @description Helper functions to construct canonical and social URLs for SEO meta tags.
 * @module lib/utils
 */

/**
 * Resolves the canonical/page URL for SEO meta tags (canonical, og:url, twitter:url).
 * Normalizes slashes, strips queries and hash fragments,
 * and ensures a trailing slash (consistent with trailingSlash: true in next.config.ts).
 * Returns undefined if siteUrl is unset or empty.
 *
 * @param path - Current route path (e.g. "/" or "/history" or "/history/?x=1#y")
 * @param siteUrl - Configured site URL (e.g. "https://example.org/" or "https://example.org/preview/")
 * @returns Fully qualified canonical URL or undefined if siteUrl is unset
 */
export function resolveSeoPageUrl(
  path: string,
  siteUrl?: string
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
  const pathWithoutQuery = path.split(/[?#]/)[0];
  const cleanPath = pathWithoutQuery.replace(/^\/+|\/+$/g, "");

  if (!cleanPath) {
    return `${base}/`;
  }

  return `${base}/${cleanPath}/`;
}

/**
 * Resolves the absolute URL for social share images (og:image, twitter:image).
 * Returns undefined if siteUrl is unset or image is empty (social crawlers require absolute URLs).
 * If the image path is already absolute (http:// or https://), returns it unchanged.
 *
 * @param image - Image path or URL (e.g. "/logo/gluon.png" or "https://example.org/image.png")
 * @param siteUrl - Configured site URL (e.g. "https://example.org/")
 * @returns Fully qualified image URL or undefined
 */
export function resolveSeoImageUrl(
  image?: string,
  siteUrl?: string
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
  const normalizedImage = image.startsWith("/") ? image : `/${image}`;

  return `${base}${normalizedImage}`;
}

export interface BuildSeoUrlsParams {
  path: string;
  image?: string;
  siteUrl?: string;
  includePageUrl?: boolean;
}

export interface SeoUrlsResult {
  pageUrl: string | undefined;
  imageUrl: string | undefined;
}

/**
 * Pure function building canonical page and image URLs for SEO tags.
 * Returns { pageUrl, imageUrl }.
 * When siteUrl is unset or empty, both fields are undefined.
 * When includePageUrl is false, pageUrl is undefined while imageUrl is still computed.
 */
export function buildSeoUrls({
  path,
  image,
  siteUrl,
  includePageUrl = true,
}: BuildSeoUrlsParams): SeoUrlsResult {
  const imageUrl = resolveSeoImageUrl(image, siteUrl);
  if (!includePageUrl) {
    return { pageUrl: undefined, imageUrl };
  }
  const pageUrl = resolveSeoPageUrl(path, siteUrl);
  return { pageUrl, imageUrl };
}
