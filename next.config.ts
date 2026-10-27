/**
 * @file next.config.ts
 * @description Next.js configuration for static export (GitHub Pages).
 * Server features (headers, rewrites, image optimisation) are not available
 * in static exports and are intentionally omitted.
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export", // `next build` writes the static site to out/
  trailingSlash: true, // /swap/ → out/swap/index.html (served by GitHub Pages)
  images: { unoptimized: true }, // image optimisation requires a server
  // Set via NEXT_PUBLIC_BASE_PATH when the site is served from
  // https://<owner>.github.io/<repo>/ instead of a custom domain.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  reactStrictMode: true,
};

export default nextConfig;
