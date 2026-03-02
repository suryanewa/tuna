"use client";

import * as React from "react";

interface UseScrubOptions {
  value: string | number | undefined;
  onChange: (value: string | undefined) => void;
  onBlur?: (value: string | undefined) => void;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  /** Numeric start value when `value` is non-numeric (e.g. "auto"). Scrub is a no-op if both are NaN. */
  resolvedValue?: number;
}

interface UseScrubReturn {
  scrubProps: {
    ref: React.RefObject<HTMLDivElement>;
    onPointerDown: (e: React.PointerEvent) => void;
  };
  isScrubbing: boolean;
}

const THRESHOLD_PX = 3;

const EW_RESIZE_SVG = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><g filter="url(#filter0_d_801_18672)"><path d="M11.8655 11.9257C12.8599 11.4619 14.0003 12.1878 14.0003 13.2851V18.7148C14.0002 19.812 12.8598 20.5378 11.8655 20.0741L6.04814 17.3593C4.93003 16.8374 4.89526 15.2807 5.94365 14.6943L6.04814 14.6406L11.8655 11.9257ZM18.0003 13.2851C18.0003 12.1877 19.1406 11.4616 20.1351 11.9257L25.9524 14.6406C27.0701 15.1626 27.1049 16.7192 26.0569 17.3056L25.9524 17.3593L20.1351 20.0741C19.1406 20.5382 18.0004 19.8121 18.0003 18.7148V13.2851ZM13.0003 13.2851C13.0003 12.9194 12.6198 12.6775 12.2884 12.832L6.47099 15.5468C6.08646 15.7264 6.08646 16.2735 6.47099 16.4531L12.2884 19.1679C12.599 19.3125 12.9533 19.1093 12.9964 18.7822L13.0003 18.7148V13.2851ZM19.7122 12.832C19.4015 12.687 19.0473 12.8904 19.0042 13.2177L19.0003 13.2851V18.7148L19.0042 18.7822C19.0474 19.1093 19.4016 19.3129 19.7122 19.1679L25.5296 16.4531C25.9137 16.2734 25.9136 15.7266 25.5296 15.5468L19.7122 12.832Z" fill="white"/></g><path d="M12.2885 12.8316C12.6198 12.677 13.0001 12.9192 13.0004 13.2847V18.7154C13.0001 19.0809 12.6198 19.3231 12.2885 19.1685L6.47111 16.4527C6.08646 16.2731 6.08645 15.727 6.47111 15.5474L12.2885 12.8316ZM19.0004 13.2847C19.0007 12.9193 19.3801 12.6773 19.7113 12.8316L25.5287 15.5474C25.9135 15.727 25.9135 16.2731 25.5287 16.4527L19.7113 19.1685C19.3801 19.3229 19.0007 19.0809 19.0004 18.7154V13.2847Z" fill="black"/><defs><filter id="filter0_d_801_18672" x="2.18262" y="9.7832" width="27.6353" height="14.4336" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/><feOffset dy="1"/><feGaussianBlur stdDeviation="1.5"/><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.35 0"/><feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_801_18672"/><feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_801_18672" result="shape"/></filter></defs></svg>`;

/** CSS cursor value — use this for hover state to match the scrub cursor */
export const EW_RESIZE_CURSOR = `url('data:image/svg+xml;charset=utf-8,${encodeURIComponent(EW_RESIZE_SVG)}') 16 16, ew-resize`;

export function useScrub({
  value,
  onChange,
  onBlur,
  step = 1,
  min,
  max,
  disabled = false,
  resolvedValue,
}: UseScrubOptions): UseScrubReturn {
  const ref = React.useRef<HTMLDivElement>(null!);
  const [isScrubbing, setIsScrubbing] = React.useState(false);

  // Mutable state refs
  const startValueRef = React.useRef(0);
  const accumulatorRef = React.useRef(0);
  const thresholdMetRef = React.useRef(false);
  const rawMovementRef = React.useRef(0);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const cursorStyleRef = React.useRef<HTMLStyleElement | null>(null);
  const customCursorRef = React.useRef<HTMLDivElement | null>(null);
  const startPosRef = React.useRef({ x: 0, y: 0 });
  const lastClientXRef = React.useRef(0);
  const pointerIdRef = React.useRef(0);
  const exitingIntentionallyRef = React.useRef(false);
  const activeRef = React.useRef(false);

  // Keep latest values in refs to avoid stale closures
  const valueRef = React.useRef(value);
  valueRef.current = value;
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const onBlurRef = React.useRef(onBlur);
  onBlurRef.current = onBlur;
  const stepRef = React.useRef(step);
  stepRef.current = step;
  const minRef = React.useRef(min);
  minRef.current = min;
  const maxRef = React.useRef(max);
  maxRef.current = max;
  const resolvedValueRef = React.useRef(resolvedValue);
  resolvedValueRef.current = resolvedValue;

  const computeValue = React.useCallback((rawValue: number): number => {
    const effectiveStep = stepRef.current;
    const precision =
      effectiveStep < 1
        ? Math.max(0, -Math.floor(Math.log10(effectiveStep)))
        : 0;
    let rounded = Number(rawValue.toFixed(precision));
    if (minRef.current !== undefined) rounded = Math.max(minRef.current, rounded);
    if (maxRef.current !== undefined) rounded = Math.min(maxRef.current, rounded);
    return rounded;
  }, []);

  const cleanup = React.useCallback(() => {
    if (abortControllerRef.current === null) return; // idempotent guard

    // 1. Set intentional exit flag BEFORE exiting lock
    exitingIntentionallyRef.current = true;

    // 2. Exit pointer lock BEFORE aborting listeners
    //    (exitPointerLock may synchronously fire pointerlockchange)
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    // 3. Abort all listeners
    abortControllerRef.current.abort();
    abortControllerRef.current = null;

    // 4. Remove DOM elements
    cursorStyleRef.current?.remove();
    cursorStyleRef.current = null;
    customCursorRef.current?.remove();
    customCursorRef.current = null;

    // 5. Update state
    activeRef.current = false;
    setIsScrubbing(false);

    // 6. Safety: catch late pointer lock activation (click race condition)
    const lockedElement = ref.current;
    requestAnimationFrame(() => {
      if (document.pointerLockElement === lockedElement) {
        document.exitPointerLock();
      }
    });
  }, []);

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || !e.isPrimary || e.pointerType === "touch" || disabled)
        return;
      if (abortControllerRef.current !== null) return; // multi-pointer guard
      e.preventDefault();

      const parsed = parseFloat(String(valueRef.current));
      if (isNaN(parsed)) {
        if (resolvedValueRef.current !== undefined) {
          startValueRef.current = resolvedValueRef.current;
        } else {
          return; // Can't scrub — no numeric or resolved value
        }
      } else {
        startValueRef.current = parsed;
      }
      accumulatorRef.current = 0;
      thresholdMetRef.current = false;
      rawMovementRef.current = 0;
      startPosRef.current = { x: e.clientX, y: e.clientY };
      lastClientXRef.current = e.clientX;
      pointerIdRef.current = e.pointerId;
      activeRef.current = true;
      exitingIntentionallyRef.current = false;

      // Request Pointer Lock from pointerdown (valid user gesture in all browsers)
      // Promise.resolve handles Safari <16.1 which returns undefined
      Promise.resolve(ref.current?.requestPointerLock()).catch(() => {
        // Fallback: use setPointerCapture for off-window tracking
        ref.current?.setPointerCapture(pointerIdRef.current);
      });

      const ac = new AbortController();
      abortControllerRef.current = ac;

      // --- Move handler (both mousemove and pointermove) ---
      // Frame-based dedup: process whichever event fires first per frame.
      // Chrome fires both during Pointer Lock, Firefox only mousemove, Safari only pointermove.
      let processedThisFrame = false;

      const onMove = (ev: MouseEvent) => {
        if (processedThisFrame) return;
        processedThisFrame = true;
        requestAnimationFrame(() => { processedThisFrame = false; });

        const locked = document.pointerLockElement != null;
        let delta: number;
        if (locked) {
          delta = ev.movementX;
        } else {
          delta = ev.clientX - lastClientXRef.current;
          lastClientXRef.current = ev.clientX;
        }

        if (!thresholdMetRef.current) {
          rawMovementRef.current += Math.abs(delta);
          if (rawMovementRef.current >= THRESHOLD_PX) {
            thresholdMetRef.current = true;
            setIsScrubbing(true);

            // Inject global cursor + selection style (deferred to threshold)
            const style = document.createElement("style");
            style.textContent =
              "* { cursor: none !important; user-select: none !important; }";
            document.head.appendChild(style);
            cursorStyleRef.current = style;

            // Create custom cursor at mousedown position
            const { x, y } = startPosRef.current;
            const cursor = document.createElement("div");
            cursor.style.cssText = `position:fixed;left:${x - 16}px;top:${y - 16}px;width:32px;height:32px;z-index:2147483647;pointer-events:none;`;
            cursor.innerHTML = EW_RESIZE_SVG;
            document.body.appendChild(cursor);
            customCursorRef.current = cursor;
          }
          return; // don't apply pre-threshold movement to value
        }

        // Threshold met — compute new value
        const multiplier = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1;
        accumulatorRef.current += delta * stepRef.current * multiplier;
        const newValue = startValueRef.current + accumulatorRef.current;
        const rounded = computeValue(newValue);
        onChangeRef.current(String(rounded));
      };

      // --- Up handler (both pointerup and mouseup) ---
      const onUp = () => {
        if (!thresholdMetRef.current) {
          // Click — focus the sibling input
          const input = ref.current?.parentElement?.querySelector("input");
          if (input) {
            input.focus();
            input.select();
          }
        } else {
          // Scrub end — commit via onBlur
          const finalValue = computeValue(
            startValueRef.current + accumulatorRef.current
          );
          onBlurRef.current?.(String(finalValue));
        }
        cleanup();
      };

      // --- Cancel handler ---
      const onCancel = () => {
        onChangeRef.current(String(computeValue(startValueRef.current)));
        cleanup();
      };

      // --- Keydown handler ---
      const onKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === "Escape" && thresholdMetRef.current) {
          ev.preventDefault();
          ev.stopPropagation();
          // During Pointer Lock, browser consumes ESC and pointerlockchange handles it.
          // This handler is for fallback mode (no pointer lock).
          if (!document.pointerLockElement) {
            onChangeRef.current(String(computeValue(startValueRef.current)));
            cleanup();
          }
        }
      };

      // --- Pointer Lock change handler ---
      const onLockChange = () => {
        if (!document.pointerLockElement) {
          // Lock was exited
          if (exitingIntentionallyRef.current) return; // normal cleanup exit
          // User pressed ESC — revert value
          if (thresholdMetRef.current) {
            onChangeRef.current(String(computeValue(startValueRef.current)));
            cleanup();
          }
        } else {
          // Lock just activated
          if (!activeRef.current) {
            // Late activation after click cleanup — exit immediately
            document.exitPointerLock();
          }
        }
      };

      // Register all listeners
      document.addEventListener("pointermove", onMove as EventListener, {
        signal: ac.signal,
      });
      document.addEventListener("mousemove", onMove, { signal: ac.signal });
      document.addEventListener("pointerup", onUp, { signal: ac.signal });
      document.addEventListener("mouseup", onUp, { signal: ac.signal });
      document.addEventListener("pointercancel", onCancel, { signal: ac.signal });
      document.addEventListener("keydown", onKeyDown, { signal: ac.signal, capture: true });
      document.addEventListener("pointerlockchange", onLockChange, {
        signal: ac.signal,
      });
    },
    [disabled, cleanup, computeValue]
  );

  // Cleanup on unmount — remove DOM elements directly (not through idempotent guard)
  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      cursorStyleRef.current?.remove();
      cursorStyleRef.current = null;
      customCursorRef.current?.remove();
      customCursorRef.current = null;
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    };
  }, []);

  // Cleanup if disabled changes to true during active scrub
  React.useEffect(() => {
    if (disabled && abortControllerRef.current) {
      onChangeRef.current(String(computeValue(startValueRef.current)));
      cleanup();
    }
  }, [disabled, cleanup, computeValue]);

  return {
    scrubProps: { ref, onPointerDown },
    isScrubbing,
  };
}
