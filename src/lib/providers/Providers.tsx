/**
 * @file Providers.tsx
 * @description Root application providers wrapper mounting Theme, Ergo, and Gluon providers.
 * @module lib/providers
 */
"use client";
import { ErgoProvider } from "./ErgoProvider";
import { ThemeProvider } from "./theme-provider";
import { GluonProvider } from "./GluonProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ErgoProvider>
        <GluonProvider>{children}</GluonProvider>
      </ErgoProvider>
    </ThemeProvider>
  );
}
