"use client";

import { EmojiPicker as EmojiPickerPrimitive, useActiveEmoji } from "frimousse";

function ActiveEmojiFooter() {
  const emoji = useActiveEmoji();
  return emoji ? (
    <>
      <div
        style={{
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          flexShrink: 0,
        }}
      >
        {emoji.emoji}
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: "#6b7280",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {emoji.label}
      </span>
    </>
  ) : (
    <span
      style={{
        marginLeft: 8,
        fontSize: 12,
        fontWeight: 500,
        color: "#9ca3af",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      Select an emoji...
    </span>
  );
}

interface EmojiPickerProps {
  columns?: number;
  onEmojiSelect?: (emoji: { emoji: string; label: string }) => void;
}

function EmojiPicker({ columns = 8, onEmojiSelect }: EmojiPickerProps) {
  return (
    <EmojiPickerPrimitive.Root
      style={{
        isolation: "isolate",
        display: "flex",
        height: 382,
        width: "fit-content",
        flexDirection: "column",
        overflow: "hidden",
      }}
      columns={columns}
      onEmojiSelect={onEmojiSelect}
    >
      {/* Search */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          padding: "8px 8px 0",
          flexShrink: 0,
        }}
      >
        <div style={{ position: "relative", flex: 1 }}>
          <svg
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            viewBox="0 0 16 16"
            style={{
              position: "absolute",
              top: "50%",
              left: 8,
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: "#9ca3af",
            }}
          >
            <path d="M7 12.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Zm7 1.5-3-3" />
          </svg>
          <EmojiPickerPrimitive.Search
            autoFocus
            placeholder="Search emoji..."
            style={{
              height: 32,
              width: "100%",
              appearance: "none",
              borderRadius: 6,
              background: "#f3f4f6",
              padding: "6px 10px 6px 30px",
              fontSize: 14,
              outline: "none",
              border: "none",
            }}
          />
        </div>
      </div>

      {/* Emoji grid */}
      <EmojiPickerPrimitive.Viewport
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          outline: "none",
        }}
      >
        <EmojiPickerPrimitive.Loading
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#9ca3af",
          }}
        >
          Loading...
        </EmojiPickerPrimitive.Loading>
        <EmojiPickerPrimitive.Empty
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            color: "#9ca3af",
          }}
        >
          No emoji found.
        </EmojiPickerPrimitive.Empty>
        <EmojiPickerPrimitive.List
          style={{ userSelect: "none", paddingBottom: 6 }}
          components={{
            Row: ({ children, ...props }) => (
              <div {...props} style={{ ...props.style, padding: "0 6px" }}>
                {children}
              </div>
            ),
            Emoji: ({ emoji, ...props }) => (
              <button
                {...props}
                style={{
                  ...props.style,
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 6,
                  fontSize: 18,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {emoji.emoji}
              </button>
            ),
            CategoryHeader: ({ category, ...props }) => (
              <div
                {...props}
                style={{
                  ...props.style,
                  position: "relative",
                  background: "white",
                  padding: "12px 12px 6px",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#6b7280",
                }}
              >
                {category.label}
              </div>
            ),
          }}
        />
      </EmojiPickerPrimitive.Viewport>

      {/* Footer */}
      <div
        style={{
          zIndex: 10,
          display: "flex",
          width: "100%",
          minWidth: 0,
          alignItems: "center",
          gap: 4,
          padding: 8,
          borderTop: "1px solid #f3f4f6",
          flexShrink: 0,
        }}
      >
        <ActiveEmojiFooter />
      </div>
    </EmojiPickerPrimitive.Root>
  );
}

export { EmojiPicker };
