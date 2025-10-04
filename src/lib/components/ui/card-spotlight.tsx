"use client";

import { useMotionValue, motion, useMotionTemplate } from "framer-motion";
import React, { PointerEvent as ReactPointerEvent, useState, useEffect } from "react";
import { CanvasRevealEffect } from "./canvas-reveal-effect";
import { cn } from "@/lib/utils/utils";

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

  // Theme-aware colors
  const canvasColors = isDarkTheme
    ? [
        [245, 194, 66], // darker yellow
        [245, 114, 66], // darker red
      ]
    : [
        [253, 230, 138], // light yellow
        [252, 165, 165], // light red
      ];

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
        {isHovering && (
          <CanvasRevealEffect
            animationSpeed={9}
            containerClassName="bg-transparent absolute inset-0 pointer-events-none"
            colors={canvasColors}
            dotSize={3}
          />
        )}
      </motion.div>
      {children}
    </div>
  );
};
