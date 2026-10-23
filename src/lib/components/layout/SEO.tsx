/**
 * @file SEO.tsx
 * @description SEO meta tags and social share previews component.
 * @module lib/components/layout
 */
import Head from "next/head";
import { tokenConfig, formatPegAsset } from "@/config/tokenConfig";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  /** Canonical URL for og:url / twitter:url. Omit to suppress those tags.
   *  Full NEXT_PUBLIC_SITE_URL wiring lands in commit 2 (tokenConfig rebuild). */
  url?: string;
  type?: string;
}

export function SEO({
  title = `Gluon ${tokenConfig.peg.type} | ${tokenConfig.peg.type}-Pegged Stablecoin on the Ergo Blockchain`,
  description = `Gluon ${tokenConfig.peg.type} on Ergo is a fully autonomous stablecoin based on the novel Gluon Stablecoin Protocol, pegged to ${tokenConfig.peg.type}, backed by the ERG cryptocurrency and running in a fully decentralized manner on the Ergo blockchain. Mint, swap and trade ${formatPegAsset()}-pegged stable tokens or leveraged yield tokens according to your stability or volatility needs.`,
  keywords = `Blockchain, Cryptocurrency, Stablecoin, DeFi, Decentralized Finance, Digital Assets, Tokens, ${tokenConfig.peg.type}, Gluon, Stability, ${tokenConfig.stableAsset.symbol}, ${tokenConfig.volatileAsset.symbol}, ${tokenConfig.peg.type}-Pegged Stablecoin, ${tokenConfig.peg.type}-Pegged Token, Crypto-Backed Stablecoin`,
  image = "/logo/gluon.png",
  url, // no hardcoded default; omit to suppress og:url/twitter:url
  type = "website",
}: SEOProps) {
  const siteTitle = title.includes("Gluon") ? title : `${title} | Gluon`;

  return (
    <Head>
      {/* Primary Meta Tags */}
      <title>{siteTitle}</title>
      <meta name="title" content={siteTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      {url && <meta property="og:url" content={url} />}
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      {url && <meta property="twitter:url" content={url} />}
      <meta property="twitter:title" content={siteTitle} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={image} />

      {/* Favicon */}
      <link rel="icon" href={tokenConfig.favicon} />
    </Head>
  );
}
