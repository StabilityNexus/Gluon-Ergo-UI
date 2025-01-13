"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { motion } from "framer-motion"
import { Toggle } from "@/lib/components/ui/toggle"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Toggle
      aria-label="Toggle theme"
      pressed={theme === "dark"}
      onPressedChange={(pressed) => setTheme(pressed ? "dark" : "light")}
      className=" data-[state=on]:bg-white/15 border shadow-sm transition-colors"
    >
      <div className="relative h-[1.2rem] w-[1.2rem] flex items-center justify-center">
        <motion.div
          initial={{ scale: 1 }}
          animate={{ 
            scale: theme === "dark" ? 0 : 1,
            rotate: theme === "dark" ? -45 : 0 
          }}
          transition={{ 
            duration: 0.2,
            ease: "easeInOut"
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
            scale: theme === "dark" ? 1 : 0,
            rotate: theme === "dark" ? 0 : 45 
          }}
          transition={{ 
            duration: 0.2,
            ease: "easeInOut"
          }}
          style={{ originX: "50%", originY: "50%" }}
        >
          <Moon className="h-4 w-4" />
        </motion.div>
      </div>
      <span className="sr-only">Toggle theme</span>
    </Toggle>
  )
}