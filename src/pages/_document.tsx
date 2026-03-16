import { Html, Head, Main, NextScript } from "next/document";
import { tokenConfig } from "@/config/tokenConfig";
import { tokenThemeCssVariables } from "@/config/tokenConfig";

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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content={tokenConfig.theme.primary} />
        <meta name="robots" content="index, follow" />
        <meta name="google" content="notranslate" />
        <link rel="canonical" href="https://gluon.fi" />

        {/* Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Apple Touch Icon */}
        <link rel="apple-touch-icon" href={tokenConfig.favicon} />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
