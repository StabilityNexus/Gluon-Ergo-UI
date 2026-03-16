"use client";

import { useMotionValue, motion, useMotionTemplate } from "framer-motion";
import React, { PointerEvent as ReactPointerEvent, useState, useEffect } from "react";
import { CanvasRevealEffect } from "./canvas-reveal-effect";
import { cn } from "@/lib/utils/utils";
import { tokenConfig } from "@/config/tokenConfig";

const hexToRgb = (hexColor: string): [number, number, number] => {
  const normalized = hexColor.replace("#", "");
  const expanded = normalized.length === 3 ? normalized.split("").map((c) => c + c).join("") : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return [128, 128, 128];
  return [
    parseInt(expanded.slice(0, 2), 16),
    parseInt(expanded.slice(2, 4), 16),
    parseInt(expanded.slice(4, 6), 16),
  ];
};

export const CardSpotlight = ({
  children,
  radius = 350,
  //color = "#262626",
  className,
  ...props
}: {
  radius?: number;
  color?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const [isHovering, setIsHovering] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      setIsDarkTheme(document.documentElement.classList.contains("dark"));
    };

    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  // Pointer-aware spotlight
  function handlePointerMove({ currentTarget, clientX, clientY, pointerType }: ReactPointerEvent<HTMLDivElement>) {
    if (pointerType !== "mouse") return; // Skip spotlight on touch/pen

    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  const handlePointerEnter = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") {
      setIsHovering(true);
    }
  };

  const handlePointerLeave = () => {
    setIsHovering(false);
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") {
      setIsHovering(false); // Prevent stuck state on touch
    }
  };

  // Protocol-aware colors
  const stableRgb = hexToRgb(tokenConfig.theme.stableToken);
  const volatileRgb = hexToRgb(tokenConfig.theme.volatileToken);

  // Adjust brightness based on theme for the best spotlight effect
  const adjustRgb = (rgb: [number, number, number], factor: number): [number, number, number] => [
    Math.min(255, rgb[0] * factor),
    Math.min(255, rgb[1] * factor),
    Math.min(255, rgb[2] * factor),
  ];

  const canvasColors = isDarkTheme
    ? [adjustRgb(stableRgb, 0.9), adjustRgb(volatileRgb, 0.9)]
    : [adjustRgb(stableRgb, 1.2), adjustRgb(volatileRgb, 1.2)];
  return (
    <div
      className={cn("group/spotlight relative rounded-md border border-border bg-background p-10", className)}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      {...props}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px z-0 rounded-md opacity-0 transition duration-300 group-hover/spotlight:opacity-100"
        style={{
          maskImage: useMotionTemplate`
            radial-gradient(
              ${radius}px circle at ${mouseX}px ${mouseY}px,
              white,
              transparent 80%
            )
          `,
        }}
      >
        {isHovering && <CanvasRevealEffect animationSpeed={9} containerClassName="bg-transparent absolute inset-0 pointer-events-none" colors={canvasColors} dotSize={3} />}
      </motion.div>
      {children}
    </div>
  );
};
