# Tuna Chrome Extension

This private workspace builds a Manifest V3 Chrome extension that injects the Tuna overlay into arbitrary webpages.

## Build

```bash
npm run build -w tuna-chrome-extension
```

Then load `packages/chrome-extension/dist` in Chrome at `chrome://extensions` with developer mode enabled.

The extension action toggles Tuna on the current `http`, `https`, or `file` page. The content script renders the existing Tuna overlay with `force` and `defaultOpen`, so copy-to-clipboard behavior and the MCP WebSocket bridge continue to use the same overlay implementation.

## MCP

Run the Tuna MCP server as usual:

```bash
npx tuna
```

The injected overlay connects to `ws://localhost:9223/ws` using the same `tuna-overlay` handshake as app-embedded Tuna.
