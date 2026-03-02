"use client";

import { Node, Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import FontFamily from "@tiptap/extension-font-family";

// ---------------------------------------------------------------------------
// FlatDocument – replaces the default Document node so the editor produces
// only inline content (text, marks, hard breaks) with no <p> wrappers.
// This is critical because Tiptap content goes inside elements like <p>,
// <h2>, <button>, or <span> that already exist in the design canvas.
// ---------------------------------------------------------------------------

const FlatDocument = Node.create({
  name: "doc",
  topNode: true,
  content: "inline*",
});

// ---------------------------------------------------------------------------
// TextStyle attribute extensions – each one piggybacks on the TextStyle mark
// to persist an additional CSS property through the editor's HTML round-trip.
// ---------------------------------------------------------------------------

const FontWeightExtension = Extension.create({
  name: "fontWeightAttr",

  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontWeight: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              element.style.fontWeight || null,
            renderHTML: (attributes: Record<string, unknown>) => {
              if (!attributes.fontWeight) return {};
              return { style: `font-weight: ${attributes.fontWeight}` };
            },
          },
        },
      },
    ];
  },
});

const FontSizeExtension = Extension.create({
  name: "fontSizeAttr",

  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              element.style.fontSize || null,
            renderHTML: (attributes: Record<string, unknown>) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

const LetterSpacingExtension = Extension.create({
  name: "letterSpacingAttr",

  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          letterSpacing: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              element.style.letterSpacing || null,
            renderHTML: (attributes: Record<string, unknown>) => {
              if (!attributes.letterSpacing) return {};
              return { style: `letter-spacing: ${attributes.letterSpacing}` };
            },
          },
        },
      },
    ];
  },
});

// ---------------------------------------------------------------------------
// Factory – assembles the complete extension array for a Tiptap editor.
// ---------------------------------------------------------------------------

export function createEditorExtensions() {
  return [
    FlatDocument,

    StarterKit.configure({
      document: false,
      paragraph: false,
      // Disable all block-level nodes — our FlatDocument uses inline-only content
      heading: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      blockquote: false,
      codeBlock: false,
      horizontalRule: false,
    }),

    TextStyle,
    Color,
    Underline,

    Link.configure({
      openOnClick: false,
      autolink: false,
    }),

    FontFamily,

    FontWeightExtension,
    FontSizeExtension,
    LetterSpacingExtension,
  ];
}
