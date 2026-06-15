import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { Tuna } from "../../overlay/src/overlay/Tuna";
import type { ChromeMessage } from "./chrome";

const ROOT_ID = "__tuna_chrome_extension_root";

let root: Root | null = null;
let mounted = false;

function fallbackCopy(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.cssText = [
    "position: fixed",
    "top: 0",
    "left: 0",
    "width: 1px",
    "height: 1px",
    "padding: 0",
    "border: 0",
    "opacity: 0",
    "pointer-events: none",
  ].join(";");

  document.documentElement.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  try {
    return document.execCommand("copy");
  } finally {
    textarea.remove();
  }
}

function installClipboardFallback() {
  const nativeClipboard = navigator.clipboard;
  const nativeWriteText = nativeClipboard?.writeText?.bind(nativeClipboard);

  const clipboard = {
    ...nativeClipboard,
    writeText: async (text: string) => {
      if (nativeWriteText) {
        try {
          await nativeWriteText(text);
          return;
        } catch {
          // Fall through to execCommand. Some pages expose Clipboard API but
          // reject writes from content scripts outside secure contexts.
        }
      }

      if (!fallbackCopy(text)) {
        throw new DOMException("Unable to copy text from Tuna content script.", "NotAllowedError");
      }
    },
  } as Clipboard;

  try {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: clipboard,
    });
    return;
  } catch {
    // Try patching the Clipboard instance itself before falling back to native behavior.
  }

  if (nativeClipboard) {
    try {
      Object.defineProperty(nativeClipboard, "writeText", {
        configurable: true,
        value: clipboard.writeText,
      });
    } catch {
      // If the browser refuses both patches, Tuna still tries the native API.
    }
  }
}

function ensureRootElement(): HTMLElement {
  const existing = document.getElementById(ROOT_ID);
  if (existing) return existing;

  const container = document.createElement("div");
  container.id = ROOT_ID;
  container.style.display = "contents";
  document.documentElement.appendChild(container);
  return container;
}

function mountTuna(defaultOpen: boolean) {
  installClipboardFallback();

  if (!root) {
    root = createRoot(ensureRootElement());
    root.render(<Tuna force defaultOpen={defaultOpen} loadRemoteFonts={false} />);
    mounted = true;
    return;
  }

  mounted = true;
  if (defaultOpen) {
    window.dispatchEvent(new CustomEvent("tuna:activate"));
  }
}

function toggleTuna() {
  if (!mounted) {
    mountTuna(true);
    return;
  }

  window.dispatchEvent(new CustomEvent("tuna:toggle"));
}

chrome?.runtime.onMessage.addListener((message: ChromeMessage, _sender, sendResponse) => {
  if (message.type === "TUNA_TOGGLE_OVERLAY") {
    toggleTuna();
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "TUNA_ACTIVATE_OVERLAY") {
    mountTuna(true);
    sendResponse({ ok: true });
  }
});
