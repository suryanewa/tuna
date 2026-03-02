"use client";

import { WarningSmall } from "@/components/icons/editor";
import { Close } from "@/components/icons/editor";
import type { VisualBellEntry } from "./VisualBellContext";

interface VisualBellProps {
  entry: VisualBellEntry;
  onDismiss: (id: string) => void;
}

export function VisualBell({ entry, onDismiss }: VisualBellProps) {
  const isError = entry.variant === "error";
  const dividerColor = isError
    ? "rgba(0,0,0,0.1)"
    : "rgba(255,255,255,0.1)";

  return (
    <div
      style={{
        height: 40,
        width: "fit-content",
        borderRadius: 14,
        backgroundColor: isError ? "#dc2626" : "#1c1917",
        boxShadow:
          "0px 0px 0.5px rgba(0,0,0,0.3), 0px 1px 3px rgba(0,0,0,0.15)",
        display: "flex",
        alignItems: "center",
        paddingLeft: 8,
        paddingRight: 0,
        gap: 0,
        overflow: "clip",
        pointerEvents: "auto",
      }}
    >
      {/* Warning icon (error only) */}
      {isError && (
        <div style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <WarningSmall size={24} className="text-white" />
        </div>
      )}

      {/* Message */}
      <span
        style={{
          fontSize: 11,
          fontWeight: 550,
          letterSpacing: "0.055px",
          lineHeight: "16px",
          color: "white",
          whiteSpace: "nowrap",
          padding: "0 4px",
        }}
      >
        {entry.message}
      </span>

      {/* Action button (optional) */}
      {entry.action && (
        <button
          type="button"
          onClick={() => { entry.action!.onClick(); onDismiss(entry.id); }}
          style={{
            height: 24,
            borderRadius: 5,
            border: `1px solid ${dividerColor}`,
            background: "transparent",
            color: "white",
            fontSize: 11,
            fontWeight: 450,
            letterSpacing: "0.055px",
            lineHeight: "16px",
            paddingLeft: 8,
            paddingRight: 8,
            marginLeft: 4,
            cursor: "default",
            flexShrink: 0,
          }}
        >
          {entry.action.label}
        </button>
      )}

      {/* Divider */}
      <div
        style={{
          width: 1,
          height: 40,
          backgroundColor: dividerColor,
          marginLeft: 8,
          flexShrink: 0,
        }}
      />

      {/* Close button */}
      <button
        type="button"
        onClick={() => onDismiss(entry.id)}
        style={{
          width: 32,
          height: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          cursor: "default",
          padding: 0,
          margin: 0,
          color: "white",
          flexShrink: 0,
        }}
      >
        <Close size={24} />
      </button>
    </div>
  );
}
