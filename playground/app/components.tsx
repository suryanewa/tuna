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
        <SparkleIcon />
        <span className="sparkle-action-text">Try Tuna</span>
      </button>
      <span className="sparkle-action-particles" aria-hidden="true">
        {Array.from({ length: 10 }).map((_, index) => (
          <SparkParticle key={index} />
        ))}
      </span>
    </span>
  );
}

function SparkleIcon() {
  return (
    <svg className="sparkle-action-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.187 8.096 15 5.25l.813 2.846a5.001 5.001 0 0 0 3.09 3.09L21.75 12l-2.846.813a5.001 5.001 0 0 0-3.09 3.09L15 18.75l-.813-2.846a5.001 5.001 0 0 0-3.09-3.09L8.25 12l2.846-.813a5.001 5.001 0 0 0 3.09-3.09Z" />
      <path d="m6 14.25-.259 1.035a3.75 3.75 0 0 1-2.456 2.456L2.25 18l1.035.259a3.75 3.75 0 0 1 2.456 2.456L6 21.75l.259-1.035a3.75 3.75 0 0 1 2.455-2.456L9.75 18l-1.036-.259a3.75 3.75 0 0 1-2.455-2.456Z" />
      <path d="m6.5 4-.197.592a1.5 1.5 0 0 1-.711.711L5 5.5l.592.197a1.5 1.5 0 0 1 .711.711L6.5 7l.197-.592a1.5 1.5 0 0 1 .711-.711L8 5.5l-.592-.197a1.5 1.5 0 0 1-.711-.711Z" />
    </svg>
  );
}

function SparkParticle() {
  return (
    <svg className="sparkle-action-particle" viewBox="0 0 15 15" aria-hidden="true">
      <path d="m6.937 3.846.813-2.846.813 2.846a5.001 5.001 0 0 0 3.09 3.09l2.847.814-2.846.813a5.001 5.001 0 0 0-3.09 3.09L7.75 14.5l-.813-2.846a5.001 5.001 0 0 0-3.09-3.09L1 7.75l2.846-.813a5.001 5.001 0 0 0 3.09-3.09Z" />
    </svg>
  );
}
