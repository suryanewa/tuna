import { useEffect, useRef } from "react";

export function TunaLogo({ size = 20 }: { size?: number }) {
  const gRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const g = gRef.current;
    const btn = g?.closest(".tuna-toolbar-collapse-btn");
    if (!g || !btn) return;
    const logoGroup = g;

    const seq: string[][] = [
      ["sq1"], ["sq2"], ["sq3"], ["sq4"], ["sq5"], ["sq6"],
      ["sq7"], ["sq8"], ["sq9"], ["sq10"], ["sq11"], ["sq12"],
      ["sq13L", "sq13R"], ["sq14L", "sq14R"],
    ];

    const stagger = 45;
    const flash = 300;
    const pause = 200;
    const cycleTime = seq.length * stagger + flash + pause;
    let hovering = false;
    let timers: ReturnType<typeof setTimeout>[] = [];

    const isP3 = window.matchMedia("(color-gamut: p3)").matches;

    function randomColor() {
      const h = Math.random() * 360;
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const l = isDark ? 0.7 + Math.random() * 0.15 : 0.6 + Math.random() * 0.1;
      const c = isP3 ? 0.3 + Math.random() * 0.1 : 0.2 + Math.random() * 0.08;
      return isP3
        ? `oklch(${l} ${c} ${h})`
        : `hsl(${h}, 100%, ${isDark ? 50 + Math.random() * 25 : 50 + Math.random() * 15}%)`;
    }

    function clearAll() {
      timers.forEach(clearTimeout);
      timers = [];
    }

    function resetRects() {
      logoGroup.querySelectorAll("rect").forEach((el) => {
        el.style.transition = "none";
        el.style.fill = "";
        el.removeAttribute("filter");
      });
    }

    function runCycle() {
      if (!hovering) return;
      const color = randomColor();
      seq.forEach((ids, i) => {
        timers.push(setTimeout(() => {
          if (!hovering) return;
          ids.forEach((id) => {
            const el = logoGroup.querySelector(`#${id}`) as SVGRectElement | null;
            if (!el) return;
            el.style.transition = "none";
            el.style.fill = color;
            el.setAttribute("filter", "url(#tuna-bloom)");
            el.getBoundingClientRect();
            el.style.transition = `fill ${flash}ms ease-out`;
            el.style.fill = "";
            timers.push(setTimeout(() => el.removeAttribute("filter"), 80));
          });
        }, i * stagger));
      });
      timers.push(setTimeout(runCycle, cycleTime));
    }

    function onEnter() {
      hovering = true;
      runCycle();
    }

    function onLeave() {
      hovering = false;
      clearAll();
      resetRects();
    }

    btn.addEventListener("mouseenter", onEnter);
    btn.addEventListener("mouseleave", onLeave);
    return () => {
      btn.removeEventListener("mouseenter", onEnter);
      btn.removeEventListener("mouseleave", onLeave);
      clearAll();
    };
  }, []);

  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <defs>
        <filter id="tuna-bloom" x="-100%" y="-100%" width="300%" height="300%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="wideBlur"/>
          <feColorMatrix in="wideBlur" type="matrix" result="wideGlow"
            values="1.8 0 0 0 0  0 1.8 0 0 0  0 0 1.8 0 0  0 0 0 0.6 0"/>
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" result="tightBlur"/>
          <feColorMatrix in="tightBlur" type="matrix" result="tightGlow"
            values="2 0 0 0 0.1  0 2 0 0 0.1  0 0 2 0 0.1  0 0 0 0.9 0"/>
          <feColorMatrix in="SourceGraphic" type="matrix" result="hotCore"
            values="1 0 0 0 0.4  0 1 0 0 0.4  0 0 1 0 0.4  0 0 0 1 0"/>
          <feMerge>
            <feMergeNode in="wideGlow"/>
            <feMergeNode in="tightGlow"/>
            <feMergeNode in="hotCore"/>
          </feMerge>
        </filter>
      </defs>
      <g ref={gRef}>
        <rect id="sq1" x="3" y="15" width="2" height="2" fill="currentColor"/>
        <rect id="sq2" x="3" y="13" width="2" height="2" fill="currentColor"/>
        <rect id="sq3" x="3" y="11" width="2" height="2" fill="currentColor"/>
        <rect id="sq4" x="3" y="9" width="2" height="2" fill="currentColor"/>
        <rect id="sq5" x="3" y="7" width="2" height="2" fill="currentColor"/>
        <rect id="sq6" x="3" y="5" width="2" height="2" fill="currentColor"/>
        <rect id="sq7" x="5" y="3" width="2" height="2" fill="currentColor"/>
        <rect id="sq8" x="7" y="3" width="2" height="2" fill="currentColor"/>
        <rect id="sq9" x="9" y="3" width="2" height="2" fill="currentColor"/>
        <rect id="sq10" x="11" y="5" width="2" height="2" fill="currentColor"/>
        <rect id="sq11" x="11" y="7" width="2" height="2" fill="currentColor"/>
        <rect id="sq12" x="11" y="15" width="2" height="2" fill="currentColor"/>
        <rect id="sq13L" x="9" y="13" width="2" height="2" fill="currentColor"/>
        <rect id="sq13R" x="13" y="13" width="2" height="2" fill="currentColor"/>
        <rect id="sq14L" x="7" y="11" width="2" height="2" fill="currentColor"/>
        <rect id="sq14R" x="15" y="11" width="2" height="2" fill="currentColor"/>
      </g>
    </svg>
  );
}
