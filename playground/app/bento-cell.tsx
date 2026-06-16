"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

type BentoCellProps = {
  label: string;
  value: string;
  icon?: ReactNode;
  visual?: ReactNode;
  className?: string;
};

const reverseTargets = [
  { selector: ".speak-waveform i", props: ["transform"] },
  { selector: ".select-cursor", props: ["transform"] },
  { selector: ".draw-ink-line", props: ["opacity", "strokeDashoffset"] },
  { selector: ".draw-fill", props: ["opacity"] },
  { selector: ".draw-pencil-icon", props: ["transform"] },
  { selector: ".comment-trigger", props: ["transform"] },
  { selector: ".comment-typing-wrap", props: ["width"] },
  { selector: ".comment-caret", props: ["opacity"] },
  { selector: ".handoff-packet", props: ["opacity", "transform"] },
] as const;

type AnimatedProp = (typeof reverseTargets)[number]["props"][number];
type AnimatedSnapshot = Partial<Record<AnimatedProp, string>>;

const reverseTransition =
  "opacity 220ms var(--bento-ease-out), transform 320ms var(--bento-ease-out), stroke-dashoffset 320ms var(--bento-ease-out), width 320ms var(--bento-ease-out)";

function clearAnimatedProp(element: HTMLElement | SVGElement, prop: (typeof reverseTargets)[number]["props"][number]) {
  element.style[prop] = "";
}

function clearReverseStyles(root: HTMLElement) {
  for (const target of reverseTargets) {
    for (const element of root.querySelectorAll<HTMLElement | SVGElement>(target.selector)) {
      element.style.removeProperty("animation");
      element.style.removeProperty("transition");
      for (const prop of target.props) {
        clearAnimatedProp(element, prop);
      }
    }
  }
}

export function BentoCell({ label, value, icon, visual, className }: BentoCellProps) {
  const cellRef = useRef<HTMLElement>(null);
  const cleanupRef = useRef<number | null>(null);
  const samplerRef = useRef<number | null>(null);
  const snapshotsRef = useRef(new Map<HTMLElement | SVGElement, AnimatedSnapshot>());

  function stopSampling() {
    if (samplerRef.current === null) return;
    window.cancelAnimationFrame(samplerRef.current);
    samplerRef.current = null;
  }

  function sampleAnimatedStyles(root: HTMLElement) {
    for (const target of reverseTargets) {
      for (const element of root.querySelectorAll<HTMLElement | SVGElement>(target.selector)) {
        const computed = window.getComputedStyle(element);
        const snapshot: AnimatedSnapshot = {};

        for (const prop of target.props) {
          snapshot[prop] = computed[prop];
        }

        snapshotsRef.current.set(element, snapshot);
      }
    }
  }

  function startSampling(root: HTMLElement) {
    stopSampling();

    function sampleFrame() {
      sampleAnimatedStyles(root);
      samplerRef.current = window.requestAnimationFrame(sampleFrame);
    }

    samplerRef.current = window.requestAnimationFrame(sampleFrame);
  }

  useEffect(() => {
    return () => {
      stopSampling();
      if (cleanupRef.current !== null) {
        window.clearTimeout(cleanupRef.current);
      }
    };
  }, []);

  function handlePointerEnter() {
    if (!cellRef.current) return;
    if (cleanupRef.current !== null) {
      window.clearTimeout(cleanupRef.current);
      cleanupRef.current = null;
    }
    snapshotsRef.current.clear();
    clearReverseStyles(cellRef.current);
    startSampling(cellRef.current);
  }

  function handlePointerLeave() {
    const root = cellRef.current;
    if (!root) return;
    stopSampling();

    const changed: Array<HTMLElement | SVGElement> = [];

    for (const target of reverseTargets) {
      for (const element of root.querySelectorAll<HTMLElement | SVGElement>(target.selector)) {
        const snapshot = snapshotsRef.current.get(element);
        const computed = snapshot ? null : window.getComputedStyle(element);
        element.style.animation = "none";
        element.style.transition = "none";

        for (const prop of target.props) {
          element.style[prop] = snapshot?.[prop] ?? computed?.[prop] ?? "";
        }

        changed.push(element);
      }
    }

    if (changed.length === 0) return;

    root.getBoundingClientRect();

    window.requestAnimationFrame(() => {
      for (const target of reverseTargets) {
        for (const element of root.querySelectorAll<HTMLElement | SVGElement>(target.selector)) {
          element.style.transition = reverseTransition;
          for (const prop of target.props) {
            clearAnimatedProp(element, prop);
          }
        }
      }
    });

    cleanupRef.current = window.setTimeout(() => {
      cleanupRef.current = null;
      snapshotsRef.current.clear();
      clearReverseStyles(root);
    }, 360);
  }

  return (
    <article
      ref={cellRef}
      className={`bento-cell ${className || ""}`}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onMouseEnter={handlePointerEnter}
      onMouseLeave={handlePointerLeave}
    >
      <h3 className="bento-cell-label">
        <span>{label}</span>
        {icon && <span className="bento-cell-icon">{icon}</span>}
      </h3>
      {visual && (
        <div className="bento-cell-demo" aria-hidden="true">
          {visual}
        </div>
      )}
      <p className="bento-cell-copy">{value}</p>
    </article>
  );
}
