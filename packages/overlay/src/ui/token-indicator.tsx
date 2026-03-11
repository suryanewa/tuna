/**
 * TokenIndicator — small dot shown on inputs when the current value
 * comes from a utility-class token. Clicking opens the token picker.
 */

import type { TokenMatch } from "../tokens/types";

export interface TokenIndicatorProps {
  match: TokenMatch;
  onClick: () => void;
}

export function TokenIndicator({ match, onClick }: TokenIndicatorProps) {
  return (
    <button
      className="retune-token-dot"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={`.${match.token.className}`}
      type="button"
    >
      <span className="retune-token-dot-inner" />
    </button>
  );
}
