/**
 * @file setup.ts
 * @description Test environment setup: initializes JSDOM globals and injects synthetic test deployments.
 * @module test
 */
import { JSDOM } from "jsdom";
import { deploymentFromRecord } from "@stability-nexus/gluon-ergo-sdk";
import { registerTestDeployment } from "@/config/env";

// 1. Initialize DOM globals for Bun test runner
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  url: "https://gold.gluon.stability.nexus/",
  pretendToBeVisual: true,
});

globalThis.window = dom.window as unknown as Window & typeof globalThis;
globalThis.document = dom.window.document;
globalThis.navigator = dom.window.navigator;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
globalThis.MutationObserver = dom.window.MutationObserver;
globalThis.Event = dom.window.Event as unknown as typeof Event;
globalThis.CustomEvent = dom.window.CustomEvent as unknown as typeof CustomEvent;

// 2. Set test environment variables
process.env.NEXT_PUBLIC_GLUON_DEPLOYMENT = "gluon-gold-v3";
process.env.NEXT_PUBLIC_NODE_URL = "https://node.sigmaspace.io";
process.env.NEXT_PUBLIC_SITE_URL = "https://gold.gluon.stability.nexus/";

// 3. Register synthetic deployment for testing (R9 hex "590280897a" decodes to pair [1n, 1000000n])
export const syntheticGoldDeployment = deploymentFromRecord({
  name: "gluon-gold-v3",
  status: "live",
  peg: "1g gold",
  ergoTree: "0008cd0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
  address: "9f4QF8AD1nQ3nJahQVkMj8hFSVVzVom77b52JU7EW71Zexg6N8v",
  tokens: {
    nft: { id: "a".repeat(64), name: "GluonGoldNFT", decimals: 0, emission: 1n },
    neutron: { id: "b".repeat(64), name: "GAU", decimals: 9, emission: 1000000000000000000n },
    proton: { id: "c".repeat(64), name: "GAUC", decimals: 9, emission: 1000000000000000000n },
  },
  constants: {
    _MinFee: "1000000",
    _OraclePoolNFT: "d".repeat(64),
    _OracleBuybackNFT: "e".repeat(64),
    _OracleFeePk: "0008cd0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
  },
  genesis: {
    registers: {
      R9: "590280897a",
    },
  },
});

registerTestDeployment(syntheticGoldDeployment);
