"use client";

import { useState, useEffect } from "react";
import type { Editor } from "@tiptap/react";

export interface InlineSelectionStyles {
  fontWeight: string | null;
  fontFamily: string | null;
  fontSize: string | null;
  letterSpacing: string | null;
  color: string | null;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrike: boolean;
  link: { href: string; target: string } | null;
}

export function useTiptapSelectionStyles(
  editor: Editor | null
): InlineSelectionStyles | null {
  const [styles, setStyles] = useState<InlineSelectionStyles | null>(null);

  useEffect(() => {
    if (!editor) {
      setStyles(null);
      return;
    }

    const updateStyles = () => {
      const textStyle = editor.getAttributes("textStyle");
      const linkAttrs = editor.getAttributes("link");

      setStyles({
        fontWeight: textStyle.fontWeight ?? null,
        fontFamily: textStyle.fontFamily ?? null,
        fontSize: textStyle.fontSize ?? null,
        letterSpacing: textStyle.letterSpacing ?? null,
        color: textStyle.color ?? null,
        isBold: editor.isActive("bold"),
        isItalic: editor.isActive("italic"),
        isUnderline: editor.isActive("underline"),
        isStrike: editor.isActive("strike"),
        link: editor.isActive("link")
            ? { href: linkAttrs.href ?? "", target: linkAttrs.target ?? "_blank" }
            : null,
      });
    };

    updateStyles();

    editor.on("selectionUpdate", updateStyles);
    editor.on("transaction", updateStyles);

    return () => {
      editor.off("selectionUpdate", updateStyles);
      editor.off("transaction", updateStyles);
    };
  }, [editor]);

  return styles;
}

// --- CSS <-> display converters ---

export function cssFontSizeToDisplay(css: string | null): string | undefined {
  if (!css) return undefined;
  return css.replace("px", "");
}

export function displayFontSizeToCss(display: string | undefined): string | null {
  if (!display) return null;
  const num = parseFloat(display);
  if (isNaN(num)) return null;
  return `${num}px`;
}

export function cssLetterSpacingToDisplay(css: string | null): string | undefined {
  if (!css) return undefined;
  return css.replace(/em|px|rem/, "");
}

export function displayLetterSpacingToCss(display: string | undefined): string | null {
  if (!display) return null;
  const num = parseFloat(display);
  if (isNaN(num)) return null;
  return `${num}em`;
}

export function cssFontWeightToDisplay(css: string | null): string | undefined {
  if (!css) return undefined;
  return css;
}

export function displayFontWeightToCss(display: string | undefined): string | null {
  if (!display) return null;
  return display;
}
