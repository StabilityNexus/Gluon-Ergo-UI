/**
 * Centralized token configuration
 * This file defines all token names, symbols, and peg-related text
 * to make the frontend generic and configurable.
 *
 * Configuration can be overridden via environment variables:
 * - NEXT_PUBLIC_PROTOCOL_NAME: Protocol name (default: GLUON GOLD)
 * - NEXT_PUBLIC_NEUTRON_TICKER: Stable token symbol (default: GAU)
 * - NEXT_PUBLIC_PROTON_TICKER: Volatile token symbol (default: GAUC)
 * - NEXT_PUBLIC_PEG_ASSET: Peg asset name (default: Gold)
 * - NEXT_PUBLIC_PEG_UNIT: Peg unit (default: 1g)
 * - NEXT_PUBLIC_PEG_DESCRIPTION: Peg description (default: "Pegged to 1 gram of gold.")
 * - NEXT_PUBLIC_THEME_PRIMARY: Primary UI color (default: #ffd007)
 * - NEXT_PUBLIC_THEME_GLOW: Glow and highlight color (default: #ffd007)
 * - NEXT_PUBLIC_THEME_STABLE_TOKEN: Stable token color (default: #ffd007)
 * - NEXT_PUBLIC_THEME_VOLATILE_TOKEN: Volatile token color (default: #ff3b3b)
 * - NEXT_PUBLIC_THEME_ACCENT_LIGHT: Light-mode accent token channels (default: 48 16.129% 93.9216%)
 * - NEXT_PUBLIC_THEME_ACCENT_FOREGROUND_LIGHT: Light-mode accent foreground channels (default: 55 100% 40%)
 * - NEXT_PUBLIC_THEME_ACCENT_DARK: Dark-mode accent token channels (default: 30 5.2632% 14.902%)
 * - NEXT_PUBLIC_THEME_ACCENT_FOREGROUND_DARK: Dark-mode accent foreground channels (default: 48 100% 45.098%)
 * - NEXT_PUBLIC_THEME_SIDEBAR_ACCENT_LIGHT: Light-mode sidebar accent channels (default: 48 100% 96.0784%)
 * - NEXT_PUBLIC_THEME_SIDEBAR_ACCENT_FOREGROUND_LIGHT: Light-mode sidebar accent foreground channels (default: 22.7273 82.5% 31.3725%)
 * - NEXT_PUBLIC_THEME_SIDEBAR_ACCENT_DARK: Dark-mode sidebar accent channels (default: 22.7273 82.5% 31.3725%)
 * - NEXT_PUBLIC_THEME_SIDEBAR_ACCENT_FOREGROUND_DARK: Dark-mode sidebar accent foreground channels (default: 48 96.6387% 76.6667%)
 * - NEXT_PUBLIC_THEME_CHART_3: Chart color 3 HSL channels (default: 25.9649 90.4762% 37.0588%)
 * - NEXT_PUBLIC_THEME_CHART_4: Chart color 4 HSL channels (default: 22.7273 82.5% 31.3725%)
 * - NEXT_PUBLIC_THEME_CHART_5: Chart color 5 HSL channels (default: 21.7143 77.7778% 26.4706%)
 * - NEXT_PUBLIC_THEME_BUTTON_HOVER_FOREGROUND_LIGHT: Light-mode button hover text channels (default: 48 100% 51%)
 * - NEXT_PUBLIC_THEME_BUTTON_HOVER_FOREGROUND_DARK: Dark-mode button hover text channels (default: 48 100% 51%)
 */

export interface TokenConfig {
  // Protocol name
  protocolName: string;

  // Protocol favicon path
  favicon: string;
  
  // Base asset (e.g., ERG)
  baseAsset: {
    name: string;
    symbol: string;
  };
  
  // Stable asset (internally referred to as neutron)
  stableAsset: {
    name: string;
    symbol: string;
    displayName: string; // Full display name
    description: string; // Description text
  };
  
  // Volatile asset (internally referred to as proton)
  volatileAsset: {
    name: string;
    symbol: string;
    displayName: string; // Full display name
    description: string; // Description text
  };
  
  // Peg configuration
  peg: {
    type: string; // e.g., "Gold", "USD"
    unit: string; // e.g., "1g", "1 USD"
    description: string; // Description of the peg
  };
  
  // Pair token (combined stable + volatile)
  pairToken: {
    name: string;
    symbol: string;
  };

  // Theme colors for protocol-specific UI variants
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

// Read configuration from environment variables with defaults
const protocolName = process.env.NEXT_PUBLIC_PROTOCOL_NAME || "GLUON GOLD";
const neutronTicker = process.env.NEXT_PUBLIC_NEUTRON_TICKER || "GAU";
const protonTicker = process.env.NEXT_PUBLIC_PROTON_TICKER || "GAUC";
const pegAsset = process.env.NEXT_PUBLIC_PEG_ASSET || "Gold";
const pegUnit = process.env.NEXT_PUBLIC_PEG_UNIT || "1g";
const favicon = process.env.NEXT_PUBLIC_FAVICON || "/logo/gluon.png";
const themePrimary = process.env.NEXT_PUBLIC_THEME_PRIMARY || "#ffd007";
const themeGlow = process.env.NEXT_PUBLIC_THEME_GLOW || "#ffd007";
const themeStableToken = process.env.NEXT_PUBLIC_THEME_STABLE_TOKEN || "#ffd007";
const themeVolatileToken = process.env.NEXT_PUBLIC_THEME_VOLATILE_TOKEN || "#ff3b3b";
const themeAccentLight = process.env.NEXT_PUBLIC_THEME_ACCENT_LIGHT || "48 16.129% 93.9216%";
const themeAccentForegroundLight = process.env.NEXT_PUBLIC_THEME_ACCENT_FOREGROUND_LIGHT || "55 100% 40%";
const themeAccentDark = process.env.NEXT_PUBLIC_THEME_ACCENT_DARK || "30 5.2632% 14.902%";
const themeAccentForegroundDark = process.env.NEXT_PUBLIC_THEME_ACCENT_FOREGROUND_DARK || "48 100% 45.098%";
const themeSidebarAccentLight = process.env.NEXT_PUBLIC_THEME_SIDEBAR_ACCENT_LIGHT || "48 100% 96.0784%";
const themeSidebarAccentForegroundLight = process.env.NEXT_PUBLIC_THEME_SIDEBAR_ACCENT_FOREGROUND_LIGHT || "22.7273 82.5% 31.3725%";
const themeSidebarAccentDark = process.env.NEXT_PUBLIC_THEME_SIDEBAR_ACCENT_DARK || "22.7273 82.5% 31.3725%";
const themeSidebarAccentForegroundDark = process.env.NEXT_PUBLIC_THEME_SIDEBAR_ACCENT_FOREGROUND_DARK || "48 96.6387% 76.6667%";
const themeChart3 = process.env.NEXT_PUBLIC_THEME_CHART_3 || "25.9649 90.4762% 37.0588%";
const themeChart4 = process.env.NEXT_PUBLIC_THEME_CHART_4 || "22.7273 82.5% 31.3725%";
const themeChart5 = process.env.NEXT_PUBLIC_THEME_CHART_5 || "21.7143 77.7778% 26.4706%";
const themeButtonHoverForegroundLight = process.env.NEXT_PUBLIC_THEME_BUTTON_HOVER_FOREGROUND_LIGHT || "48 100% 51%";
const themeButtonHoverForegroundDark = process.env.NEXT_PUBLIC_THEME_BUTTON_HOVER_FOREGROUND_DARK || "48 100% 51%";

const hexToHslChannels = (hexColor: string): string => {
  const normalized = hexColor.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return "48 100% 51%";
  }

  const r = parseInt(expanded.slice(0, 2), 16) / 255;
  const g = parseInt(expanded.slice(2, 4), 16) / 255;
  const b = parseInt(expanded.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  if (delta !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / delta + 2) / 6;
        break;
      case b:
        h = ((r - g) / delta + 4) / 6;
        break;
      default:
        h = 0;
    }
  }

  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return `${(h * 360).toFixed(4)} ${(s * 100).toFixed(4)}% ${(l * 100).toFixed(4)}%`;
};

/**
 * Smart formatting for peg asset names.
 * Currency codes (USD, EUR, etc.) stay uppercase.
 * Commodity names (Gold, Silver, etc.) become lowercase for sentences.
 */
const formatPegAssetForSentence = (asset: string): string => {
  // Check if it's likely a currency code:
  // - 2-4 characters
  // - All uppercase or title case
  // - Common currency codes
  const currencyCodes = ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "CNY", "INR"];
  
  if (currencyCodes.includes(asset.toUpperCase())) {
    return asset.toUpperCase();
  }
  
  // If it's 2-4 chars and all uppercase, assume it's a currency code
  if (asset.length >= 2 && asset.length <= 4 && asset === asset.toUpperCase()) {
    return asset;
  }
  
  // Otherwise, it's a commodity name - lowercase it
  return asset.toLowerCase();
};

// Smart description generation:
// If pegUnit already contains the asset (like "1 USD"), don't add "of {asset}"
// If pegUnit is just a quantity (like "1g"), add "of {asset}"
const generateStableDescription = () => {
  const unitLower = pegUnit.toLowerCase();
  const assetLower = pegAsset.toLowerCase();
  
  // Check if pegUnit already contains the asset name
  if (unitLower.includes(assetLower)) {
    return `The stablecoin pegged to ${pegUnit}.`;
  }
  
  // For quantities like "1g", "1oz", add "of {asset}"
  const formattedAsset = formatPegAssetForSentence(pegAsset);
  return `The stablecoin pegged to ${pegUnit} of ${formattedAsset}.`;
};

const pegDescription =
  process.env.NEXT_PUBLIC_PEG_DESCRIPTION ||
  (pegUnit.toLowerCase().includes(pegAsset.toLowerCase()) ? `Pegged to ${pegUnit}.` : `Pegged to ${pegUnit} of ${formatPegAssetForSentence(pegAsset)}.`);

// Protocol configuration - configurable via environment variables
export const tokenConfig: TokenConfig = {
  protocolName,
  favicon,
  baseAsset: {
    name: "Ergo",
    symbol: "ERG",
  },
  stableAsset: {
    name: neutronTicker,
    symbol: neutronTicker,
    displayName: neutronTicker,
    description: generateStableDescription(),
  },
  volatileAsset: {
    name: protonTicker,
    symbol: protonTicker,
    displayName: protonTicker,
    description: "Tokenizes the reserve surplus and provides leveraged volatility and yield.",
  },
  peg: {
    type: pegAsset,
    unit: pegUnit,
    description: pegDescription,
  },
  pairToken: {
    name: `${neutronTicker}-${protonTicker} Pair`,
    symbol: `${neutronTicker}-${protonTicker}`,
  },
  theme: {
    primary: themePrimary,
    glow: themeGlow,
    stableToken: themeStableToken,
    volatileToken: themeVolatileToken,
    accentLight: themeAccentLight,
    accentForegroundLight: themeAccentForegroundLight,
    accentDark: themeAccentDark,
    accentForegroundDark: themeAccentForegroundDark,
    sidebarAccentLight: themeSidebarAccentLight,
    sidebarAccentForegroundLight: themeSidebarAccentForegroundLight,
    sidebarAccentDark: themeSidebarAccentDark,
    sidebarAccentForegroundDark: themeSidebarAccentForegroundDark,
    chart3: themeChart3,
    chart4: themeChart4,
    chart5: themeChart5,
    buttonHoverForegroundLight: themeButtonHoverForegroundLight,
    buttonHoverForegroundDark: themeButtonHoverForegroundDark,
  },
};

export const tokenThemeCssVariables = {
  "--primary": hexToHslChannels(tokenConfig.theme.primary),
  "--ring": hexToHslChannels(tokenConfig.theme.glow),
  "--chart-1": hexToHslChannels(tokenConfig.theme.stableToken),
  "--chart-2": hexToHslChannels(tokenConfig.theme.volatileToken),
  "--sidebar-primary": hexToHslChannels(tokenConfig.theme.primary),
  "--sidebar-ring": hexToHslChannels(tokenConfig.theme.glow),
  "--theme-accent-light": tokenConfig.theme.accentLight,
  "--theme-accent-foreground-light": tokenConfig.theme.accentForegroundLight,
  "--theme-accent-dark": tokenConfig.theme.accentDark,
  "--theme-accent-foreground-dark": tokenConfig.theme.accentForegroundDark,
  "--theme-sidebar-accent-light": tokenConfig.theme.sidebarAccentLight,
  "--theme-sidebar-accent-foreground-light": tokenConfig.theme.sidebarAccentForegroundLight,
  "--theme-sidebar-accent-dark": tokenConfig.theme.sidebarAccentDark,
  "--theme-sidebar-accent-foreground-dark": tokenConfig.theme.sidebarAccentForegroundDark,
  "--theme-chart-3": tokenConfig.theme.chart3,
  "--theme-chart-4": tokenConfig.theme.chart4,
  "--theme-chart-5": tokenConfig.theme.chart5,
  "--theme-button-hover-foreground-light": tokenConfig.theme.buttonHoverForegroundLight,
  "--theme-button-hover-foreground-dark": tokenConfig.theme.buttonHoverForegroundDark,
} as const;

// Helper functions to get token symbols (for backward compatibility during migration)
export const getStableAssetSymbol = (): string => tokenConfig.stableAsset.symbol;
export const getVolatileAssetSymbol = (): string => tokenConfig.volatileAsset.symbol;
export const getPairTokenSymbol = (): string => tokenConfig.pairToken.symbol;
export const getBaseAssetSymbol = (): string => tokenConfig.baseAsset.symbol;

// Helper to get peg description
export const getPegDescription = (): string => tokenConfig.peg.description;

/**
 * Format peg asset for use in sentences.
 * Preserves uppercase for currency codes (USD, EUR), uses lowercase for commodities (gold, silver).
 */
export const formatPegAsset = (): string => {
  const asset = tokenConfig.peg.type;
  const currencyCodes = ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "CNY", "INR", "BTC", "ETH"];
  
  if (currencyCodes.includes(asset.toUpperCase())) {
    return asset.toUpperCase();
  }
  
  // If it's 2-4 chars and all uppercase, assume it's a currency code
  if (asset.length >= 2 && asset.length <= 4 && asset === asset.toUpperCase()) {
    return asset;
  }
  
  // Otherwise, it's a commodity name - lowercase it
  return asset.toLowerCase();
};

