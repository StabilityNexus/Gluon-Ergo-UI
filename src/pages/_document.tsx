/**
 * @file _document.tsx
 * @description Next.js Document component setting static-export CSP, HTML lang, and themed styles.
 * @module pages
 */
import { Html, Head, Main, NextScript } from "next/document";
import { tokenConfig } from "@/config/tokenConfig";
import { tokenThemeCssVariables } from "@/config/tokenConfig";
import { resolveAssetPath } from "@/lib/utils/asset-path";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function Document() {
  return (
    // Inline styles on <html> set CSS variables at the highest possible
    // specificity — they override any stylesheet (including globals.css)
    // regardless of injection order. This ensures all protocol-themed
    // elements (bg-primary, text-primary, ring, charts, etc.) use the
    // correct color from the very first server-rendered paint.
    <Html lang="en" style={tokenThemeCssVariables as React.CSSProperties}>
      <Head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content={tokenConfig.theme.primary} />
        <meta name="robots" content="index, follow" />
        <meta name="google" content="notranslate" />

        {/* CSP — replaces the headers() in next.config.ts (not available in
            static exports). 'unsafe-inline' is retained for Next.js inline
            scripts. A meta CSP cannot set frame-ancestors. */}
        <meta httpEquiv="Content-Security-Policy" content="script-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'" />

        {/* Manifest and Apple Touch Icon — paths go through resolveAssetPath
            so they work under any NEXT_PUBLIC_BASE_PATH. */}
        <link rel="manifest" href={resolveAssetPath("/manifest.json", BASE_PATH)} />
        <link rel="apple-touch-icon" href={resolveAssetPath(tokenConfig.favicon, BASE_PATH)} />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
