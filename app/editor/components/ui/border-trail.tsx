"use client";

import { motion, type Transition } from "framer-motion";

export type BorderTrailProps = {
  className?: string;
  size?: number;
  transition?: Transition;
  style?: React.CSSProperties;
};

export function BorderTrail({
  className,
  size = 60,
  transition,
  style,
}: BorderTrailProps) {
  const defaultTransition: Transition = {
    repeat: Infinity,
    duration: 5,
    ease: "linear",
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: "inherit",
        border: "2px solid transparent",
        maskClip: "padding-box, border-box",
        maskComposite: "intersect",
        maskImage:
          "linear-gradient(transparent,transparent),linear-gradient(#000,#000)",
        WebkitMaskClip: "padding-box, border-box",
        WebkitMaskComposite: "source-in",
        pointerEvents: "none",
      } as React.CSSProperties}
    >
      <motion.div
        className={className}
        style={{
          position: "absolute",
          width: size,
          aspectRatio: "1",
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          ...style,
        }}
        animate={{ offsetDistance: ["0%", "100%"] }}
        transition={transition ?? defaultTransition}
      />
    </div>
  );
}
