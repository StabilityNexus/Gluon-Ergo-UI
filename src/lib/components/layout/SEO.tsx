/**
 * @file SEO.tsx
 * @description SEO meta tags and social share previews component.
 * @module lib/components/layout
 */
import Head from "next/head";
import { useRouter } from "next/router";
import { env } from "@/config/env";
import { tokenConfig, formatPegAsset } from "@/config/tokenConfig";
import { resolveAssetPath } from "@/lib/utils/asset-path";
import { buildSeoUrls } from "@/lib/utils/seo-urls";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  /** Explicit canonical/page path or full URL. If omitted, derives from router.asPath */
  path?: string;
  url?: string;
  type?: string;
  /** When true, omits canonical, og:url, and twitter:url tags (e.g. for 404 page) */
  noPageUrl?: boolean;
}

export function SEO({
  title = `Gluon ${tokenConfig.peg.type} | ${tokenConfig.peg.type}-Pegged Stablecoin on the Ergo Blockchain`,
  description = `Gluon ${tokenConfig.peg.type} on Ergo is a fully autonomous stablecoin based on the novel Gluon Stablecoin Protocol, pegged to ${tokenConfig.peg.type}, backed by the ERG cryptocurrency and running in a fully decentralized manner on the Ergo blockchain. Mint, swap and trade ${formatPegAsset()}-pegged stable tokens or leveraged yield tokens according to your stability or volatility needs.`,
  keywords = `Blockchain, Cryptocurrency, Stablecoin, DeFi, Decentralized Finance, Digital Assets, Tokens, ${tokenConfig.peg.type}, Gluon, Stability, ${tokenConfig.stableAsset.symbol}, ${tokenConfig.volatileAsset.symbol}, ${tokenConfig.peg.type}-Pegged Stablecoin, ${tokenConfig.peg.type}-Pegged Token, Crypto-Backed Stablecoin`,
  image = "/logo/gluon.png",
  path,
  url,
  type = "website",
  noPageUrl = false,
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

  const { pageUrl, imageUrl } = buildSeoUrls({
    path: currentPath,
    image,
    siteUrl: env.siteUrl,
    includePageUrl: !noPageUrl,
  });

  return (
    <Head>
      {/* Primary Meta Tags */}
      <title>{siteTitle}</title>
      <meta name="title" content={siteTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      {pageUrl && <link rel="canonical" href={pageUrl} />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      {pageUrl && <meta property="og:url" content={pageUrl} />}
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={description} />
      {imageUrl && <meta property="og:image" content={imageUrl} />}

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      {pageUrl && <meta property="twitter:url" content={pageUrl} />}
      <meta property="twitter:title" content={siteTitle} />
      <meta property="twitter:description" content={description} />
      {imageUrl && <meta property="twitter:image" content={imageUrl} />}

      {/* Favicon */}
      <link rel="icon" href={resolveAssetPath(tokenConfig.favicon, process.env.NEXT_PUBLIC_BASE_PATH)} />
    </Head>
  );
}
