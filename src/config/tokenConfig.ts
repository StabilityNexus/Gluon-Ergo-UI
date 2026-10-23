/**
 * @file tokenConfig.ts
 * @description Centralized token and protocol presentation configuration rebuilt from deployment.
 * @module config
 */
import { env } from "./env";
import { PRESENTATION, type Presentation } from "./presentation";

export interface TokenConfig {
  protocolName: string;
  favicon: string;
  baseAsset: {
    name: string;
    symbol: string;
  };
  stableAsset: {
    name: string;
    symbol: string;
    displayName: string;
    description: string;
  };
  volatileAsset: {
    name: string;
    symbol: string;
    displayName: string;
    description: string;
  };
  peg: {
    type: string;
    unit: string;
    description: string;
  };
  pairToken: {
    name: string;
    symbol: string;
  };
  theme: {
    primary: string;
    glow: string;
    stableToken: string;
    volatileToken: string;
    accentLight: string;
    accentForegroundLight: string;
    accentDark: string;
    accentForegroundDark: string;
    sidebarAccentLight: string;
    sidebarAccentForegroundLight: string;
    sidebarAccentDark: string;
    sidebarAccentForegroundDark: string;
    chart3: string;
    chart4: string;
    chart5: string;
    buttonHoverForegroundLight: string;
    buttonHoverForegroundDark: string;
  };
}

const defaultPresentation: Presentation = PRESENTATION["gluon-gold-v3"] || {
  protocolName: "GLUON GOLD",
  pegAsset: "Gold",
  pegUnit: "1g",
  favicon: "/logo/gluon.png",
  theme: {
    primary: "#ffd007",
    glow: "#ffd007",
    stableToken: "#ffd007",
    volatileToken: "#e3201f",
    accentLight: "48 16.129% 93.9216%",
    accentForegroundLight: "55 100% 40%",
    accentDark: "30 5.2632% 14.902%",
    accentForegroundDark: "48 100% 45.098%",
    sidebarAccentLight: "48 100% 96.0784%",
    sidebarAccentForegroundLight: "22.7273 82.5% 31.3725%",
    sidebarAccentDark: "22.7273 82.5% 31.3725%",
    sidebarAccentForegroundDark: "48 96.6387% 76.6667%",
    chart3: "25.9649 90.4762% 37.0588%",
    chart4: "22.7273 82.5% 31.3725%",
    chart5: "21.7143 77.7778% 26.4706%",
    buttonHoverForegroundLight: "48 88% 42%",
    buttonHoverForegroundDark: "48 90% 58%",
  },
};

const presentation: Presentation = PRESENTATION[env.deploymentName] || defaultPresentation;
const neutronTicker = env.deployment.tokens.neutron.name;
const protonTicker = env.deployment.tokens.proton.name;

const hexToHslChannels = (hexColor: string): string => {
  const normalized = hexColor.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;

  if (expanded.length !== 6) {
    return "48 100% 51%";
  }

  const r = parseInt(expanded.slice(0, 2), 16) / 255;
  const g = parseInt(expanded.slice(2, 4), 16) / 255;
  const b = parseInt(expanded.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return `${h} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

const primaryHsl = hexToHslChannels(presentation.theme.primary);

export const tokenConfig: TokenConfig = {
  protocolName: presentation.protocolName,
  favicon: presentation.favicon,
  baseAsset: {
    name: "Ergo",
    symbol: "ERG",
  },
  stableAsset: {
    name: `${presentation.pegAsset} Stable Token`,
    symbol: neutronTicker,
    displayName: `${presentation.pegAsset} Stablecoin`,
    description: `A stable asset backed by ERG reserves and pegged to ${presentation.pegUnit}.`,
  },
  volatileAsset: {
    name: `${presentation.pegAsset} Volatile Token`,
    symbol: protonTicker,
    displayName: `${presentation.pegAsset} Yield Token`,
    description: `A volatile, leveraged token designed to absorb collateral fluctuations and earn yield.`,
  },
  peg: {
    type: presentation.pegAsset,
    unit: presentation.pegUnit,
    description: `Targeting ${presentation.pegUnit}.`,
  },
  pairToken: {
    name: `${neutronTicker}-${protonTicker} Pair`,
    symbol: `${neutronTicker}/${protonTicker}`,
  },
  theme: presentation.theme,
};

export const tokenThemeCssVariables = {
  "--primary": primaryHsl,
  "--ring": primaryHsl,
  "--glow": presentation.theme.glow,
  "--stable-token": presentation.theme.stableToken,
  "--volatile-token": presentation.theme.volatileToken,
  "--accent-light": presentation.theme.accentLight,
  "--accent-foreground-light": presentation.theme.accentForegroundLight,
  "--accent-dark": presentation.theme.accentDark,
  "--accent-foreground-dark": presentation.theme.accentForegroundDark,
  "--sidebar-accent-light": presentation.theme.sidebarAccentLight,
  "--sidebar-accent-foreground-light": presentation.theme.sidebarAccentForegroundLight,
  "--sidebar-accent-dark": presentation.theme.sidebarAccentDark,
  "--sidebar-accent-foreground-dark": presentation.theme.sidebarAccentForegroundDark,
  "--chart-3": presentation.theme.chart3,
  "--chart-4": presentation.theme.chart4,
  "--chart-5": presentation.theme.chart5,
  "--button-hover-foreground-light": presentation.theme.buttonHoverForegroundLight,
  "--button-hover-foreground-dark": presentation.theme.buttonHoverForegroundDark,
};

export const formatPegAsset = (format: "lowercase" | "uppercase" | "title" = "title"): string => {
  const asset = tokenConfig.peg.type;
  switch (format) {
    case "lowercase":
      return asset.toLowerCase();
    case "uppercase":
      return asset.toUpperCase();
    case "title":
    default:
      return asset.charAt(0).toUpperCase() + asset.slice(1).toLowerCase();
  }
};

export const formatPegUnit = (): string => tokenConfig.peg.unit;
export const getPegDescription = (): string => tokenConfig.peg.description;
export const isPeggedTo = (assetType: string): boolean => tokenConfig.peg.type.toLowerCase() === assetType.toLowerCase();
export const hasDualPeg = (): boolean => false;
export const getEffectivePegType = (): string => tokenConfig.peg.type;
