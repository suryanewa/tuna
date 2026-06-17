# Tuna Chrome Extension

This private workspace builds a Manifest V3 Chrome extension that opens the Tuna overlay on arbitrary webpages. It bundles React, React DOM, and the Tuna overlay into a self-contained content script.

## Build

```bash
npm run build -w @tuna/chrome-extension
```

Then load `packages/chrome-extension/dist` in Chrome at `chrome://extensions` with developer mode enabled.

The extension action toggles Tuna on the current `http`, `https`, or `file` page. The content script renders the existing Tuna overlay with `force` and `defaultOpen`, so copy-to-clipboard behavior and the MCP WebSocket bridge continue to use the same implementation as the npm package.

## MCP

Run the Tuna MCP server as usual:

```bash
npx @suryanewa/tuna
```

The injected overlay connects to `ws://127.0.0.1:9223/ws` using the same `tuna-overlay` handshake as app-embedded Tuna.

## Notes

- `loadRemoteFonts={false}` is used in extension mode so the overlay does not inject remote font styles into arbitrary pages.
- The optional offline Whisper dependency is stubbed in the extension bundle. Chrome's native speech recognition path remains available when the browser supports it.
- React fiber/source metadata can be limited by Chrome content-script isolation on third-party pages. DOM selectors, visual changes, comments, drawings, copy output, and MCP handoff still use the normal Tuna paths.
