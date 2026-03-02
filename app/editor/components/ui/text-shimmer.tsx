"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type TextShimmerProps = {
  children: string;
  className?: string;
  duration?: number;
  spread?: number;
  baseColor?: string;
  gradientColor?: string;
};

function TextShimmerComponent({
  children,
  className,
  duration = 2,
  spread = 2,
  baseColor = "#a1a1aa",
  gradientColor = "#000",
}: TextShimmerProps) {
  const dynamicSpread = useMemo(() => {
    return children.length * spread;
  }, [children, spread]);

  return (
    <motion.span
      className={cn(
        "relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent",
        className
      )}
      initial={{ backgroundPosition: "100% center" }}
      animate={{ backgroundPosition: "0% center" }}
      transition={{
        repeat: Infinity,
        duration,
        ease: "linear",
      }}
      style={
        {
          "--spread": `${dynamicSpread}px`,
          "--base-color": baseColor,
          "--base-gradient-color": gradientColor,
          backgroundImage: `linear-gradient(90deg, #0000 calc(50% - var(--spread)), var(--base-gradient-color), #0000 calc(50% + var(--spread))), linear-gradient(var(--base-color), var(--base-color))`,
          backgroundRepeat: "no-repeat, padding-box",
        } as React.CSSProperties
      }
    >
      {children}
    </motion.span>
  );
}

export const TextShimmer = React.memo(TextShimmerComponent);
