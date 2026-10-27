/**
 * @file presentation.ts
 * @description Theme and presentation metadata for deployments.
 * @module config
 */

export interface ThemeConfig {
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
}

export interface Presentation {
  protocolName: string; // navbar and page titles: "GLUON GOLD"
  pegAsset: string; // "Gold" | "USD": also keys the transmute action types
  pegUnit: string; // "1g" | "1 USD": one neutron targets "1 <pegUnit>" at the initial peg factor
  favicon: string; // "/logo/gluon.png" | "/logo/gluon-green.png"
  theme: ThemeConfig;
}

export const PRESENTATION: Record<string, Presentation> = {
  "gluon-gold-v3": {
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
  },
  "gluon-dollar-v3": {
    protocolName: "GLUON DOLLAR",
    pegAsset: "USD",
    pegUnit: "1 USD",
    favicon: "/logo/gluon-green.png",
    theme: {
      primary: "#85BB65",
      glow: "#85BB65",
      stableToken: "#85BB65",
      volatileToken: "#C026D3",
      accentLight: "97.6744 38.7387% 56.4706%",
      accentForegroundLight: "0 0% 0%",
      accentDark: "97.6744 38.7387% 56.4706%",
      accentForegroundDark: "0 0% 0%",
      sidebarAccentLight: "142 60% 95%",
      sidebarAccentForegroundLight: "145 70% 28%",
      sidebarAccentDark: "145 46% 24%",
      sidebarAccentForegroundDark: "142 75% 72%",
      chart3: "142 55% 28%",
      chart4: "142 45% 22%",
      chart5: "142 40% 18%",
      buttonHoverForegroundLight: "97.6744 38.7387% 56.4706%",
      buttonHoverForegroundDark: "97.6744 38.7387% 56.4706%",
    },
  },
};
