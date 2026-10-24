/**
 * @file SEO.tsx
 * @description SEO meta tags and social share previews component.
 * @module lib/components/layout
 */
import Head from "next/head";
import { useRouter } from "next/router";
import { tokenConfig, formatPegAsset } from "@/config/tokenConfig";
import { resolveSeoPageUrl, resolveSeoImageUrl } from "@/lib/utils/seo-urls";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  /** Explicit canonical/page path or full URL. If omitted, derives from router.asPath */
  path?: string;
  url?: string;
  type?: string;
  siteUrl?: string;
  basePath?: string;
}

export function SEO({
  title = `Gluon ${tokenConfig.peg.type} | ${tokenConfig.peg.type}-Pegged Stablecoin on the Ergo Blockchain`,
  description = `Gluon ${tokenConfig.peg.type} on Ergo is a fully autonomous stablecoin based on the novel Gluon Stablecoin Protocol, pegged to ${tokenConfig.peg.type}, backed by the ERG cryptocurrency and running in a fully decentralized manner on the Ergo blockchain. Mint, swap and trade ${formatPegAsset()}-pegged stable tokens or leveraged yield tokens according to your stability or volatility needs.`,
  keywords = `Blockchain, Cryptocurrency, Stablecoin, DeFi, Decentralized Finance, Digital Assets, Tokens, ${tokenConfig.peg.type}, Gluon, Stability, ${tokenConfig.stableAsset.symbol}, ${tokenConfig.volatileAsset.symbol}, ${tokenConfig.peg.type}-Pegged Stablecoin, ${tokenConfig.peg.type}-Pegged Token, Crypto-Backed Stablecoin`,
  image = "/logo/gluon.png",
  path,
  url,
  type = "website",
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL,
  basePath = process.env.NEXT_PUBLIC_BASE_PATH,
}: SEOProps) {
  const siteTitle = title.includes("Gluon") ? title : `${title} | Gluon`;
  let currentPath = path || url;
  try {
    const router = useRouter();
    if (!currentPath && router) {
      currentPath = router.asPath || router.pathname || "/";
    }
  } catch {
    // In case rendered outside Router context (e.g. tests)
  }
  currentPath = currentPath || "/";

  const canonicalUrl = resolveSeoPageUrl(currentPath, siteUrl, basePath);
  const socialImageUrl = resolveSeoImageUrl(image, siteUrl, basePath);

  return (
    <Head>
      {/* Primary Meta Tags */}
      <title>{siteTitle}</title>
      <meta name="title" content={siteTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={description} />
      {socialImageUrl && <meta property="og:image" content={socialImageUrl} />}

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      {canonicalUrl && <meta property="twitter:url" content={canonicalUrl} />}
      <meta property="twitter:title" content={siteTitle} />
      <meta property="twitter:description" content={description} />
      {socialImageUrl && <meta property="twitter:image" content={socialImageUrl} />}

      {/* Favicon */}
      <link rel="icon" href={tokenConfig.favicon} />
    </Head>
  );
}
