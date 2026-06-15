/**
 * PanelBanner — reusable blue banner with copy button + dismiss.
 * Used for update notifications and manifest prompts.
 */

import { useState, useRef, useCallback } from "react";

interface PanelBannerProps {
  title: string;
  body: string;
  copyLabel: string;
  copiedLabel: string;
  copyText: string;
  /** Auto-revert copied state after this many ms. 0 = don't revert. */
  revertAfter?: number;
  onDismiss?: () => void;
  onCopy?: () => void;
  visible: boolean;
}

export function PanelBanner({
  title,
  body,
  copyLabel,
  copiedLabel,
  copyText,
  revertAfter = 0,
  onDismiss,
  onCopy,
  visible,
}: PanelBannerProps) {
  const [copied, setCopied] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleCopy = useCallback(() => {
    if (copied) return;
    const btn = btnRef.current;
    if (!btn) return;
    const oldWidth = btn.getBoundingClientRect().width;
    navigator.clipboard.writeText(copyText);
    setCopied(true);
    onCopy?.();
    requestAnimationFrame(() => {
      const newWidth = btn.getBoundingClientRect().width;
      if (Math.abs(newWidth - oldWidth) > 1) {
        btn.animate(
          [{ width: `${oldWidth}px` }, { width: `${newWidth}px` }],
          { duration: 200, easing: "cubic-bezier(0.215, 0.61, 0.355, 1)" }
        );
      }
    });
    if (revertAfter > 0) {
      setTimeout(() => {
        const b = btnRef.current;
        if (!b) return;
        const oldW = b.getBoundingClientRect().width;
        setCopied(false);
        requestAnimationFrame(() => {
          const newW = b.getBoundingClientRect().width;
          if (Math.abs(newW - oldW) > 1) {
            b.animate(
              [{ width: `${oldW}px` }, { width: `${newW}px` }],
              { duration: 200, easing: "cubic-bezier(0.215, 0.61, 0.355, 1)" }
            );
          }
        });
      }, revertAfter);
    }
  }, [copied, copyText, revertAfter]);

  if (!visible || dismissed) return null;

  const ease = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
  const crossfade = "cubic-bezier(0.215, 0.61, 0.355, 1)";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: dismissing ? "0fr" : "1fr",
        opacity: dismissing ? 0 : 1,
        transition: `grid-template-rows 150ms ${ease}, opacity 150ms ${ease}`,
      }}
      onTransitionEnd={(e) => {
        if (e.propertyName === "opacity" && dismissing) {
          setDismissed(true);
          setDismissing(false);
          onDismiss?.();
        }
      }}
    >
      <div style={{ overflow: "hidden", minHeight: 0 }}>
        <div
          style={{
            padding: "12px 16px",
            background: "var(--tuna-blue)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            transform: dismissing ? "translateY(-4px)" : "translateY(0)",
            transition: `transform 150ms ${ease}`,
          }}
        >
          <div style={{
            fontFamily: "inherit", fontSize: "12px", fontWeight: 600,
            lineHeight: "16px", letterSpacing: "-0.06px", color: "var(--tuna-white)",
          }}>
            {title}
          </div>
          {body && (
            <div style={{
              fontFamily: "inherit", fontSize: "11px", lineHeight: "16px",
              color: "var(--tuna-white)", opacity: 0.85,
            }}>
              {body}
            </div>
          )}
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              ref={btnRef}
              onClick={handleCopy}
              style={{
                background: "var(--tuna-white)",
                border: "none",
                borderRadius: "6px",
                padding: 0,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "11px",
                fontWeight: 500,
                lineHeight: "16px",
                letterSpacing: "-0.055px",
                color: "var(--tuna-always-black)",
                whiteSpace: "nowrap",
                position: "relative",
                overflow: "hidden",
                flexShrink: 0,
                transition: "transform 100ms ease",
              }}
              onPointerDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(0.97)"; }}
              onPointerUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; }}
              onPointerLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; }}
            >
              {/* Invisible sizer */}
              <span style={{
                display: "flex", gap: "2px", alignItems: "center",
                padding: "6px 8px 6px 4px", visibility: "hidden",
              }}>
                <span style={{ width: 16, height: 16, flexShrink: 0 }} />
                {copied ? copiedLabel : copyLabel}
              </span>
              {/* Overlay A: default — crossfades out */}
              <span style={{
                position: "absolute", inset: 0,
                display: "flex", gap: "2px", alignItems: "center",
                padding: "6px 8px 6px 4px",
                opacity: copied ? 0 : 1,
                filter: copied ? "blur(2px)" : "blur(0)",
                transition: `opacity 200ms ${crossfade}, filter 200ms ${crossfade}`,
              }}>
                <span style={{
                  width: 16, height: 16, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transform: copied ? "scale(0.95)" : "scale(1)",
                  transition: `transform 200ms ${crossfade}`,
                }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8.5 3.5C9.32843 3.5 10 4.17157 10 5V6H11C11.8284 6 12.5 6.67157 12.5 7.5V11C12.5 11.8284 11.8284 12.5 11 12.5H7.5C6.67157 12.5 6 11.8284 6 11V10H5C4.17157 10 3.5 9.32843 3.5 8.5V5C3.5 4.17157 4.17157 3.5 5 3.5H8.5ZM10 8.5C10 9.32843 9.32843 10 8.5 10H7V11C7 11.2761 7.22386 11.5 7.5 11.5H11C11.2761 11.5 11.5 11.2761 11.5 11V7.5C11.5 7.22386 11.2761 7 11 7H10V8.5ZM5 4.5C4.72386 4.5 4.5 4.72386 4.5 5V8.5C4.5 8.77614 4.72386 9 5 9H8.5C8.77614 9 9 8.77614 9 8.5V5C9 4.72386 8.77614 4.5 8.5 4.5H5Z" fill="currentColor" fillOpacity="0.9" />
                  </svg>
                </span>
                {copyLabel}
              </span>
              {/* Overlay B: copied — crossfades in */}
              <span style={{
                position: "absolute", inset: 0,
                display: "flex", gap: "2px", alignItems: "center",
                padding: "6px 8px 6px 4px",
                opacity: copied ? 1 : 0,
                filter: copied ? "blur(0)" : "blur(2px)",
                transition: `opacity 200ms ${crossfade}, filter 200ms ${crossfade}`,
              }}>
                <span style={{
                  width: 16, height: 16, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transform: copied ? "scale(1)" : "scale(0.95)",
                  transition: `transform 200ms ${crossfade}`,
                }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M11.0839 4.22268C11.2371 3.99294 11.5475 3.93087 11.7773 4.08401C12.007 4.23718 12.0691 4.5476 11.916 4.77737L7.91596 10.7774C7.83287 10.902 7.69784 10.9833 7.54877 10.9981C7.39988 11.0127 7.25223 10.9593 7.14643 10.8535L4.14643 7.85354C3.9512 7.65827 3.95118 7.34176 4.14643 7.14651C4.34168 6.95126 4.6582 6.95128 4.85346 7.14651L7.42182 9.71487L11.0839 4.22268Z" fill="currentColor" fillOpacity="0.9" />
                  </svg>
                </span>
                {copiedLabel}
              </span>
            </button>
            {/* Maybe later */}
            <button
              onClick={() => setDismissing(true)}
              style={{
                background: "none",
                border: "none",
                borderRadius: "6px",
                padding: "6px 8px",
                cursor: copied ? "default" : "pointer",
                fontFamily: "inherit",
                fontSize: "11px",
                fontWeight: 500,
                lineHeight: "16px",
                letterSpacing: "-0.055px",
                color: "var(--tuna-white)",
                whiteSpace: "nowrap",
                opacity: copied ? 0 : 0.9,
                filter: copied ? "blur(2px)" : "blur(0)",
                pointerEvents: copied ? "none" : "auto",
                transition: `opacity 200ms ${crossfade}, filter 200ms ${crossfade}`,
              }}
              onMouseEnter={(e) => { if (!copied) (e.currentTarget as HTMLElement).style.opacity = "1"; }}
              onMouseLeave={(e) => { if (!copied) (e.currentTarget as HTMLElement).style.opacity = "0.9"; }}
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
