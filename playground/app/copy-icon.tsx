"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes, MouseEvent } from "react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

export interface CopyIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface CopyIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  copied?: boolean;
}

const hoverTransition = {
  type: "spring" as const,
  stiffness: 560,
  damping: 32,
  mass: 0.45,
};

const checkTransition = {
  type: "spring" as const,
  stiffness: 620,
  damping: 28,
  mass: 0.4,
};

const path1Variants: Variants = {
  normal: {
    d: "M 4 14 L 4 4 L 14 4",
    opacity: 1,
    x: 0,
    y: 0,
    transition: hoverTransition,
  },
  animate: {
    d: "M 4 14 L 4 4 L 14 4",
    opacity: 1,
    x: -1,
    y: -1,
    transition: hoverTransition,
  },
  check: {
    d: "M 6 12 L 10 16 L 10 16",
    opacity: 1,
    x: 0,
    y: 0,
    transition: checkTransition,
  },
};

const path2Variants: Variants = {
  normal: {
    d: "M 9 20 L 19 20 L 19 9",
    opacity: 1,
    x: 0,
    y: 0,
    transition: hoverTransition,
  },
  animate: {
    d: "M 9 20 L 19 20 L 19 9",
    opacity: 1,
    x: 1,
    y: 1,
    transition: hoverTransition,
  },
  check: {
    d: "M 10 16 L 18 8 L 18 8",
    opacity: 1,
    x: 0,
    y: 0,
    transition: checkTransition,
  },
};

const path3Variants: Variants = {
  normal: {
    d: "M 9 9 L 9 20 L 9 20",
    opacity: 1,
    x: 0,
    y: 0,
    transition: hoverTransition,
  },
  animate: {
    d: "M 9 9 L 9 20 L 9 20",
    opacity: 1,
    x: 1,
    y: 1,
    transition: hoverTransition,
  },
  check: {
    d: "M 10 16 L 10 16 L 10 16",
    opacity: 0,
    x: 0,
    y: 0,
    transition: checkTransition,
  },
};

const path4Variants: Variants = {
  normal: {
    d: "M 9 9 L 19 9 L 19 9",
    opacity: 1,
    x: 0,
    y: 0,
    transition: hoverTransition,
  },
  animate: {
    d: "M 9 9 L 19 9 L 19 9",
    opacity: 1,
    x: 1,
    y: 1,
    transition: hoverTransition,
  },
  check: {
    d: "M 10 16 L 10 16 L 10 16",
    opacity: 0,
    x: 0,
    y: 0,
    transition: checkTransition,
  },
};

export const CopyIcon = forwardRef<CopyIconHandle, CopyIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 16, copied = false, ...props }, ref) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;

      return {
        startAnimation: () => {
          if (!copied) controls.start("animate");
        },
        stopAnimation: () => {
          if (!copied) controls.start("normal");
        },
      };
    });

    useEffect(() => {
      if (copied) {
        controls.start("check");
      } else {
        controls.start("normal");
      }
    }, [copied, controls]);

    const handleMouseEnter = useCallback(
      (e: MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseEnter?.(e);
        } else if (!copied) {
          controls.start("animate");
        }
      },
      [controls, onMouseEnter, copied],
    );

    const handleMouseLeave = useCallback(
      (e: MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseLeave?.(e);
        } else if (!copied) {
          controls.start("normal");
        }
      },
      [controls, onMouseLeave, copied],
    );

    const rootClassName = className
      ? `inline-flex shrink-0 items-center justify-center leading-none pointer-events-none ${className}`
      : "inline-flex shrink-0 items-center justify-center leading-none pointer-events-none";

    return (
      <div
        className={rootClassName}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <svg
          fill="none"
          height={size}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
        >
          <motion.path animate={controls} initial="normal" variants={path1Variants} />
          <motion.path animate={controls} initial="normal" variants={path2Variants} />
          <motion.path animate={controls} initial="normal" variants={path3Variants} />
          <motion.path animate={controls} initial="normal" variants={path4Variants} />
        </svg>
      </div>
    );
  },
);

CopyIcon.displayName = "CopyIcon";
