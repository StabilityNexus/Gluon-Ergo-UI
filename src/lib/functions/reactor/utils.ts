/**
 * @file utils.ts
 * @description Pure utilities for token definitions and swap direction mapping from deployment configuration.
 * @module lib/functions/reactor
 */
import type { GluonDeployment } from "@stability-nexus/gluon-ergo-sdk";
import { ACTION_TYPES, type ActionType } from "@/lib/constants/token";
import { tokenConfig } from "@/config/tokenConfig";
import type { Token } from "./types";

export function defaultTokens(deployment: GluonDeployment): Token[] {
  const neutronName = deployment.tokens.neutron.name;
  const protonName = deployment.tokens.proton.name;
  const pairSymbol = `${neutronName}-${protonName}`;

  const tokens: Token[] = [
    {
      symbol: "ERG",
      name: "Ergo",
      color: "bg-blue-500",
      balance: "0",
      tokenId: "ERG",
      decimals: 9,
    },
    {
      symbol: neutronName,
      name: neutronName,
      color: tokenConfig.theme.stableToken,
      balance: "0",
      tokenId: deployment.tokens.neutron.id,
      decimals: deployment.tokens.neutron.decimals,
    },
    {
      symbol: protonName,
      name: protonName,
      color: tokenConfig.theme.volatileToken,
      balance: "0",
      tokenId: deployment.tokens.proton.id,
      decimals: deployment.tokens.proton.decimals,
    },
  ];

  // Pair token requires equal decimals between neutron and proton
  if (deployment.tokens.neutron.decimals === deployment.tokens.proton.decimals) {
    tokens.push({
      symbol: pairSymbol,
      name: `${neutronName} + ${protonName}`,
      color: "bg-purple-500",
      balance: "0",
      tokenId: "PAIR",
      decimals: deployment.tokens.neutron.decimals,
    });
  }

  return tokens;
}

export function getValidToTokens(fromSymbol: string, tokens: Token[], deployment: GluonDeployment): Token[] {
  const neutronName = deployment.tokens.neutron.name;
  const protonName = deployment.tokens.proton.name;
  const pairSymbol = `${neutronName}-${protonName}`;

  if (fromSymbol === "ERG") {
    return tokens.filter((t) => t.symbol === pairSymbol);
  }
  if (fromSymbol === pairSymbol) {
    return tokens.filter((t) => t.symbol === "ERG");
  }
  if (fromSymbol === neutronName) {
    return tokens.filter((t) => t.symbol === protonName);
  }
  if (fromSymbol === protonName) {
    return tokens.filter((t) => t.symbol === neutronName);
  }
  return [];
}

export function getActionType(fromSymbol: string, toSymbol: string, deployment: GluonDeployment): ActionType | null {
  const neutronName = deployment.tokens.neutron.name;
  const protonName = deployment.tokens.proton.name;
  const pairSymbol = `${neutronName}-${protonName}`;

  if (fromSymbol === "ERG" && toSymbol === pairSymbol) {
    return ACTION_TYPES.FISSION;
  }
  if (fromSymbol === pairSymbol && toSymbol === "ERG") {
    return ACTION_TYPES.FUSION;
  }
  if (fromSymbol === protonName && toSymbol === neutronName) {
    return ACTION_TYPES.TRANSMUTE_TO_PEG;
  }
  if (fromSymbol === neutronName && toSymbol === protonName) {
    return ACTION_TYPES.TRANSMUTE_FROM_PEG;
  }
  return null;
}

export function getTitle(action: ActionType | null): string {
  switch (action) {
    case ACTION_TYPES.FISSION:
      return "FISSION";
    case ACTION_TYPES.FUSION:
      return "FUSION";
    case ACTION_TYPES.TRANSMUTE_TO_PEG:
    case ACTION_TYPES.TRANSMUTE_FROM_PEG:
      return "TRANSMUTATION";
    default:
      return "REACTOR";
  }
}

export function getDescription(action: ActionType | null, deployment: GluonDeployment): string {
  const neutronName = deployment.tokens.neutron.name;
  const protonName = deployment.tokens.proton.name;

  switch (action) {
    case ACTION_TYPES.FISSION:
      return `You are using fission to convert ERG into ${neutronName} and ${protonName}.`;
    case ACTION_TYPES.FUSION:
      return `You are using fusion to convert ${neutronName} and ${protonName} into ERG.`;
    case ACTION_TYPES.TRANSMUTE_TO_PEG:
      return `You are using transmutation to convert ${protonName} into ${neutronName}.`;
    case ACTION_TYPES.TRANSMUTE_FROM_PEG:
      return `You are using transmutation to convert ${neutronName} into ${protonName}.`;
    default:
      return "Select tokens to swap.";
  }
}
