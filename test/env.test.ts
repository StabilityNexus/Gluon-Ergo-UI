/**
 * @file env.test.ts
 * @description Unit tests for env.ts configuration validation.
 * @module test
 */
import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { validateEnv, registerTestDeployment } from "@/config/env";
import { syntheticGoldDeployment } from "./setup";

describe("env.ts validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    registerTestDeployment(syntheticGoldDeployment);
    process.env.NEXT_PUBLIC_GLUON_DEPLOYMENT = "gluon-gold-v3";
    process.env.NEXT_PUBLIC_NODE_URL = "https://node.sigmaspace.io";
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.org/";
    delete process.env.NEXT_PUBLIC_BASE_PATH;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("passes validation with valid environment variables", () => {
    const config = validateEnv();
    expect(config.deploymentName).toBe("gluon-gold-v3");
    expect(config.nodeUrl).toBe("https://node.sigmaspace.io");
    expect(config.siteUrl).toBe("https://example.org/");
  });

  it("throws when NEXT_PUBLIC_GLUON_DEPLOYMENT is missing", () => {
    delete process.env.NEXT_PUBLIC_GLUON_DEPLOYMENT;
    expect(() => validateEnv()).toThrow("NEXT_PUBLIC_GLUON_DEPLOYMENT is required");
  });

  it("throws when NEXT_PUBLIC_GLUON_DEPLOYMENT is unknown in DEPLOYMENTS", () => {
    process.env.NEXT_PUBLIC_GLUON_DEPLOYMENT = "non-existent-deployment";
    expect(() => validateEnv()).toThrow("was not found in DEPLOYMENTS");
  });

  it("throws when NEXT_PUBLIC_NODE_URL is missing", () => {
    delete process.env.NEXT_PUBLIC_NODE_URL;
    expect(() => validateEnv()).toThrow("NEXT_PUBLIC_NODE_URL is required");
  });

  it("throws when NEXT_PUBLIC_NODE_URL is not HTTPS or localhost", () => {
    process.env.NEXT_PUBLIC_NODE_URL = "http://remote-insecure-node.io";
    expect(() => validateEnv()).toThrow("must be an HTTPS URL (or http://localhost for dev)");
  });

  it("accepts http://localhost for local development", () => {
    process.env.NEXT_PUBLIC_NODE_URL = "http://localhost:9053";
    const config = validateEnv();
    expect(config.nodeUrl).toBe("http://localhost:9053");
  });

  it("throws when NEXT_PUBLIC_BASE_PATH does not start with /", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "Gluon-Ergo-UI-Gold";
    expect(() => validateEnv()).toThrow('must start with "/"');
  });

  it("throws when NEXT_PUBLIC_BASE_PATH ends with /", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/Gluon-Ergo-UI-Gold/";
    expect(() => validateEnv()).toThrow('must not end with "/"');
  });

  it("accepts valid NEXT_PUBLIC_BASE_PATH", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/Gluon-Ergo-UI-Gold";
    const config = validateEnv();
    expect(config.basePath).toBe("/Gluon-Ergo-UI-Gold");
  });

  it("throws when NEXT_PUBLIC_SITE_URL is not a valid URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "gold.example";
    expect(() => validateEnv()).toThrow("NEXT_PUBLIC_SITE_URL");
    expect(() => validateEnv()).toThrow('must be a valid absolute URL');
  });

  it("throws when NEXT_PUBLIC_SITE_URL protocol is not http or https", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "ftp://x/";
    expect(() => validateEnv()).toThrow("NEXT_PUBLIC_SITE_URL");
    expect(() => validateEnv()).toThrow('must use http: or https:');
  });

  it("throws when NEXT_PUBLIC_SITE_URL has query parameters", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.org/?a=1";
    expect(() => validateEnv()).toThrow("NEXT_PUBLIC_SITE_URL");
    expect(() => validateEnv()).toThrow('must not contain query parameters or hash fragments');
  });

  it("throws when NEXT_PUBLIC_SITE_URL has a hash fragment", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.org/#x";
    expect(() => validateEnv()).toThrow("NEXT_PUBLIC_SITE_URL");
    expect(() => validateEnv()).toThrow('must not contain query parameters or hash fragments');
  });

  it("throws when NEXT_PUBLIC_SITE_URL does not end with /", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.org/preview";
    expect(() => validateEnv()).toThrow('must end with a trailing slash "/"');
  });

  it("accepts valid NEXT_PUBLIC_SITE_URL with subpath and trailing slash", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.org/preview/";
    const config = validateEnv();
    expect(config.siteUrl).toBe("https://example.org/preview/");
  });

  it("accepts empty string NEXT_PUBLIC_SITE_URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "";
    const config = validateEnv();
    expect(config.siteUrl).toBe("");
  });

  it("accepts unset NEXT_PUBLIC_SITE_URL", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const config = validateEnv();
    expect(config.siteUrl).toBe("");
  });
});
