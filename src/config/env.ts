/**
 * @file env.ts
 * @description Validates environment variables at import time.
 * @module config
 */
import { DEPLOYMENTS, type GluonDeployment } from "@stability-nexus/gluon-ergo-sdk";

export interface EnvConfig {
  deploymentName: string;
  deployment: GluonDeployment;
  nodeUrl: string;
  siteUrl: string;
  basePath: string;
  explorerUrl: string;
  explorerApiUrl: string;
  yieldChartMinApy?: number;
}

// Registry for dynamic test deployments when SDK DEPLOYMENTS is empty
const testDeployments = new Map<string, GluonDeployment>();

export function registerTestDeployment(deployment: GluonDeployment): void {
  testDeployments.set(deployment.name, deployment);
}

export function validateEnv(): EnvConfig {
  const deploymentName = process.env.NEXT_PUBLIC_GLUON_DEPLOYMENT;
  if (!deploymentName) {
    throw new Error("Gluon UI configuration error: NEXT_PUBLIC_GLUON_DEPLOYMENT is required.");
  }

  const allDeployments: readonly GluonDeployment[] = [...DEPLOYMENTS, ...Array.from(testDeployments.values())];
  const foundDeployment = allDeployments.find((d) => d.name === deploymentName);
  if (!foundDeployment) {
    throw new Error(`Gluon UI configuration error: NEXT_PUBLIC_GLUON_DEPLOYMENT "${deploymentName}" was not found in DEPLOYMENTS.`);
  }

  const nodeUrl = process.env.NEXT_PUBLIC_NODE_URL;
  if (!nodeUrl) {
    throw new Error("Gluon UI configuration error: NEXT_PUBLIC_NODE_URL is required.");
  }

  const isLocalhost = /^http:\/\/localhost(:\d+)?(\/.*)?$/i.test(nodeUrl) || /^http:\/\/127\.0\.0\.1(:\d+)?(\/.*)?$/i.test(nodeUrl);
  const isHttps = /^https:\/\//i.test(nodeUrl);
  if (!isHttps && !isLocalhost) {
    throw new Error(`Gluon UI configuration error: NEXT_PUBLIC_NODE_URL "${nodeUrl}" must be an HTTPS URL (or http://localhost for dev).`);
  }

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  if (basePath !== "") {
    if (!basePath.startsWith("/")) {
      throw new Error(`Gluon UI configuration error: NEXT_PUBLIC_BASE_PATH "${basePath}" must start with "/".`);
    }
    if (basePath.endsWith("/")) {
      throw new Error(`Gluon UI configuration error: NEXT_PUBLIC_BASE_PATH "${basePath}" must not end with "/".`);
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  if (siteUrl !== "") {
    let parsed: URL;
    try {
      parsed = new URL(siteUrl);
    } catch {
      throw new Error(`Gluon UI configuration error: NEXT_PUBLIC_SITE_URL "${siteUrl}" must be a valid absolute URL.`);
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`Gluon UI configuration error: NEXT_PUBLIC_SITE_URL "${siteUrl}" must use http: or https:.`);
    }

    if (parsed.search || parsed.hash) {
      throw new Error(`Gluon UI configuration error: NEXT_PUBLIC_SITE_URL "${siteUrl}" must not contain query parameters or hash fragments.`);
    }

    if (!siteUrl.endsWith("/")) {
      throw new Error(`Gluon UI configuration error: NEXT_PUBLIC_SITE_URL "${siteUrl}" must end with a trailing slash "/".`);
    }
  }

  const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer.ergoplatform.com";
  const explorerApiUrl = process.env.NEXT_PUBLIC_EXPLORER_API_URL || "https://api.ergoplatform.com/api/v1";

  const minApyStr = process.env.NEXT_PUBLIC_YIELD_CHART_MIN_APY;
  const yieldChartMinApy = minApyStr ? parseFloat(minApyStr) : undefined;

  if (typeof window === "undefined" && process.env.NODE_ENV !== "test") {
    console.log(`Gluon UI: ${deploymentName}, node ${nodeUrl}`);
  }

  return {
    deploymentName,
    deployment: foundDeployment,
    nodeUrl,
    siteUrl,
    basePath,
    explorerUrl,
    explorerApiUrl,
    yieldChartMinApy,
  };
}

let cachedEnv: EnvConfig | null = null;

export function getEnv(): EnvConfig {
  if (!cachedEnv || process.env.NODE_ENV === "test") {
    if (process.env.NODE_ENV === "test" && !process.env.NEXT_PUBLIC_GLUON_DEPLOYMENT) {
      return {} as EnvConfig;
    }
    cachedEnv = validateEnv();
  }
  return cachedEnv;
}

// Validate on module import
export const env = getEnv();
