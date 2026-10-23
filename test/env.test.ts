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
    process.env.NEXT_PUBLIC_SITE_URL = "https://gold.gluon.stability.nexus/";
    delete process.env.NEXT_PUBLIC_BASE_PATH;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("passes validation with valid environment variables", () => {
    const config = validateEnv();
    expect(config.deploymentName).toBe("gluon-gold-v3");
    expect(config.nodeUrl).toBe("https://node.sigmaspace.io");
    expect(config.siteUrl).toBe("https://gold.gluon.stability.nexus/");
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

  it("throws when NEXT_PUBLIC_SITE_URL does not end with /", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://gold.gluon.stability.nexus";
    expect(() => validateEnv()).toThrow('must end with a trailing slash "/"');
  });
});
