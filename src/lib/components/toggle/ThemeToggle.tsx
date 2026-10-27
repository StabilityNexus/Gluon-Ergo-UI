"use client";

import * as React from "react";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { tokenConfig } from "@/config/tokenConfig";
import { Toggle } from "@/lib/components/ui/toggle";

function subscribeNoop() {
  return () => {};
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
  const isDark = mounted && theme === "dark";

  return (
    <Toggle
      aria-label="Toggle theme"
      pressed={isDark}
      onPressedChange={(pressed) => setTheme(pressed ? "dark" : "light")}
      className="border shadow-sm transition-colors data-[state=on]:bg-white/15"
    >
      <div className="relative flex h-[1.2rem] w-[1.2rem] items-center justify-center">
        <motion.div
          initial={{ scale: 1 }}
          animate={{
            scale: isDark ? 0 : 1,
            rotate: isDark ? -45 : 0,
          }}
          transition={{
            duration: 0.2,
            ease: "easeInOut",
          }}
          style={{ originX: "50%", originY: "50%" }}
          className="absolute"
        >
          <Sun className="h-4 w-4" />
        </motion.div>

        <motion.div
          className="absolute"
          initial={{ scale: 0 }}
          animate={{
            scale: isDark ? 1 : 0,
            rotate: isDark ? 0 : 45,
          }}
          transition={{
            duration: 0.2,
            ease: "easeInOut",
          }}
          style={{ originX: "50%", originY: "50%" }}
        >
          <Moon className="h-4 w-4" style={{ color: tokenConfig.theme.primary }} />
        </motion.div>
      </div>
      <span className="sr-only">Toggle theme</span>
    </Toggle>
  );
}
