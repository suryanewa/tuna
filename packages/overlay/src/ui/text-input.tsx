/**
 * TextInput — plain text input for free-form CSS values.
 * Used for complex values like grid-template-columns/rows
 * where scrub-to-adjust doesn't make sense.
 */

import { useState } from "react";

export interface TextInputProps {
  prop: string;
  value: string | undefined;
  onChange: (prop: string, value: string) => void;
}

export function TextInput({ prop, value, onChange }: TextInputProps) {
  const [localValue, setLocalValue] = useState(value || "");

  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setLocalValue(value || "");
  }

  return (
    <div className="composer-text-input">
      <input
        className="composer-text-input-field"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => onChange(prop, localValue)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onChange(prop, localValue);
            (e.target as HTMLInputElement).blur();
          }
        }}
        spellCheck={false}
      />
    </div>
  );
}
