/**
 * @file test-infra.test.ts
 * @description Verifies test environment setup and in-place env configuration hydration.
 * @module test
 */
import { describe, expect, it } from "bun:test";
import { env } from "@/config/env";
import { tokenConfig } from "@/config/tokenConfig";

describe("Test Infrastructure", () => {
  it("env.deployment.name equals the synthetic deployment name", () => {
    expect(env.deploymentName).toBe("gluon-gold-v3");
    expect(env.deployment.name).toBe("gluon-gold-v3");
  });

  it("importing tokenConfig exposes protocolName and synthetic token tickers", () => {
    expect(tokenConfig.protocolName).toBe("GLUON GOLD");
    expect(tokenConfig.stableAsset.symbol).toBe("GAU");
    expect(tokenConfig.volatileAsset.symbol).toBe("GAUC");
  });
});
