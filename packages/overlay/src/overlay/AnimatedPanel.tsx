import { useEffect, useRef, useState, type ReactNode } from "react";

const PANEL_ANIMATION_MS = 150;

export function AnimatedPanel({ visible, children }: { visible: boolean; children: ReactNode }) {
  const [state, setState] = useState<"hidden" | "entering" | "visible" | "exiting">("hidden");
  const prevVisibleRef = useRef(false);
  const childrenRef = useRef<ReactNode>(children);

  // Keep a snapshot of children while visible so exit animation shows content.
  if (visible) childrenRef.current = children;

  if (visible && !prevVisibleRef.current) {
    prevVisibleRef.current = true;
    setState("entering");
  } else if (!visible && prevVisibleRef.current) {
    prevVisibleRef.current = false;
    setState("exiting");
  }

  useEffect(() => {
    if (state === "entering") {
      const timer = setTimeout(() => setState("visible"), PANEL_ANIMATION_MS);
      return () => clearTimeout(timer);
    }
    if (state === "exiting") {
      const timer = setTimeout(() => setState("hidden"), PANEL_ANIMATION_MS);
      return () => clearTimeout(timer);
    }
  }, [state]);

  if (state === "hidden") return null;

  const animClass = state === "entering" ? "entering" : state === "exiting" ? "exiting" : "";
  return <div className={`retune-panel-anim ${animClass}`}>{childrenRef.current}</div>;
}
