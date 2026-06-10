/**
 * TextInput — plain text input for free-form CSS values.
 * Used for complex values like grid-template-columns/rows
 * where scrub-to-adjust doesn't make sense.
 */

import { useState, useEffect } from "react";
import { isMixedValue, MIXED_LABEL } from "./mixed-value";

export interface TextInputProps {
  prop: string;
  value: string | undefined;
  onChange: (prop: string, value: string) => void;
}

export function TextInput({ prop, value, onChange }: TextInputProps) {
  const [localValue, setLocalValue] = useState(isMixedValue(value) ? MIXED_LABEL : value || "");

  useEffect(() => {
    setLocalValue(isMixedValue(value) ? MIXED_LABEL : value || "");
  }, [value]);

  return (
    <div className="retune-text-input">
      <input
        className="retune-text-input-field"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={(e) => { if (isMixedValue(value)) setLocalValue(""); e.target.select(); }}
        onBlur={() => {
          if (isMixedValue(value) && localValue.trim() === "") {
            setLocalValue(MIXED_LABEL);
            return;
          }
          onChange(prop, localValue.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (isMixedValue(value) && localValue.trim() === "") {
              setLocalValue(MIXED_LABEL);
              (e.target as HTMLInputElement).blur();
              return;
            }
            onChange(prop, localValue.trim());
            (e.target as HTMLInputElement).blur();
          }
        }}
        spellCheck={false}
      />
    </div>
  );
}
