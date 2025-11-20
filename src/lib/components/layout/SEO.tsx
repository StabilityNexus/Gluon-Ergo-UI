import Head from "next/head";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
}

export function SEO({
  title = "Gluon Gold | Gold-Pegged Stablecoin on the Ergo Blockchain",
  description = "Gluon Gold on Ergo is a fully autonomous stablecoin based on the novel Gluon Stablecoin Protocol, pegged to Gold, backed by the ERG cryptocurrency and running in a fully decentralized manner on the Ergo blockchain. Mint, swap and trade gold-pegged stable tokens or leveraged yield tokens according to your stability or volatility needs.",
  keywords = "Blockchain, Cryptocurrency, Stablecoin, DeFi, Decentralized Finance, Digital Assets, Tokens, Gold, Gluon, Stability, GAU, CAUC, Gold-Pegged Stablecoin, Gold-Pegged Token, Crypto-Backed Stablecoin",
  image = "/logo/gluon.png",
  url = "https://www.gluon.gold/",
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
      <meta property="og:url" content={url} />
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={url} />
      <meta property="twitter:title" content={siteTitle} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={image} />

      {/* Favicon */}
      <link rel="icon" href="/favicon.ico" />
    </Head>
  );
}
