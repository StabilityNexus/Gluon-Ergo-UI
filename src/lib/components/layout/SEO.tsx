import Head from "next/head";
import { protocolConfig } from "@/lib/config/protocol";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
}

export function SEO({
  title = protocolConfig.seo.defaultTitle,
  description = protocolConfig.seo.defaultDescription,
  keywords = protocolConfig.seo.defaultKeywords,
  image = protocolConfig.seo.defaultImage,
  url = protocolConfig.seo.defaultUrl,
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
