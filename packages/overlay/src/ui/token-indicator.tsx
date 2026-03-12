/**
 * TokenIndicator — small dot shown on inputs when the current value
 * comes from a utility-class token. Hovering shows the class name tooltip.
 */

import { useState, useRef, useCallback } from "react";
import type { TokenMatch } from "../tokens/types";

export interface TokenIndicatorProps {
  match: TokenMatch;
}

export function TokenIndicator({ match }: TokenIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const dotRef = useRef<HTMLSpanElement>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback(() => {
    clearTimeout(hideTimeout.current);
    setShowTooltip(true);
  }, []);

  const hide = useCallback(() => {
    hideTimeout.current = setTimeout(() => setShowTooltip(false), 150);
  }, []);

  return (
    <span
      ref={dotRef}
      className="retune-token-dot"
      onPointerEnter={show}
      onPointerLeave={hide}
    >
      <span className="retune-token-dot-inner" />
      {showTooltip && (
        <span className="retune-token-tooltip">.{match.token.className}</span>
      )}
    </span>
  );
}
