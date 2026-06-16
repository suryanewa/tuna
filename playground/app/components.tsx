"use client";

import { useCallback, useRef, useState } from "react";
import type { CopyIconHandle } from "./copy-icon";
import { CopyIcon } from "./copy-icon";

type CopyCommandButtonProps = {
  text: string;
  className?: string;
  iconSize?: number;
};

export function CopyCommandButton({
  text,
  className = "",
  iconSize = 15,
}: CopyCommandButtonProps) {
  const [copied, setCopied] = useState(false);
  const copyIconRef = useRef<CopyIconHandle>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(text).then(() => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <button
      className={`copy-command${copied ? " is-copied" : ""} ${className}`.trim()}
      type="button"
      onClick={handleCopy}
      onMouseEnter={() => copyIconRef.current?.startAnimation()}
      onMouseLeave={() => copyIconRef.current?.stopAnimation()}
      aria-label={copied ? "Copied" : `Copy ${text}`}
    >
      <CopyIcon ref={copyIconRef} size={iconSize} copied={copied} />
    </button>
  );
}

export function TryItButton() {
  const handleClick = useCallback(() => {
    const host = document.querySelector("[data-tuna-host]") as HTMLElement | null;
    const shadow = host?.shadowRoot;
    const button = shadow?.querySelector(
      ".tuna-toolbar-collapse-btn, .tuna-toolbar button, button",
    ) as HTMLButtonElement | null;

    button?.click();
  }, []);

  return (
    <span className="sparkle-action-wrap">
      <button
        className="primary-action try-tuna-button sparkle-action"
        type="button"
        onClick={handleClick}
      >
        <span className="sparkle-action-sweep" aria-hidden="true" />
        <span className="sparkle-action-backdrop" aria-hidden="true" />
        <span className="sparkle-action-text">Try Tuna</span>
      </button>
    </span>
  );
}
