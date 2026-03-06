/**
 * Shadow DOM host for the Composer overlay.
 *
 * Creates an isolated DOM subtree that cannot be affected by
 * the host page's styles, and whose styles cannot leak out.
 */

const OVERLAY_STYLES = `
  :host {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: 13px;
    color: #1a1a1a;
    line-height: 1.4;
  }

  * {
    box-sizing: border-box;
  }

  .composer-toolbar {
    position: fixed;
    z-index: 2147483647;
    pointer-events: auto;
    background: #fff;
    border: 1px solid #e5e5e5;
    border-radius: 10px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
    padding: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
    user-select: none;
  }

  .composer-toolbar.top-right { top: 16px; right: 16px; }
  .composer-toolbar.top-left { top: 16px; left: 16px; }
  .composer-toolbar.bottom-right { bottom: 16px; right: 16px; }
  .composer-toolbar.bottom-left { bottom: 16px; left: 16px; }

  .composer-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    color: #666;
    transition: all 0.15s ease;
  }

  .composer-btn:hover {
    background: #f5f5f5;
    color: #1a1a1a;
  }

  .composer-btn.active {
    background: #3b82f6;
    color: #fff;
  }

  .composer-btn.active:hover {
    background: #2563eb;
  }

  .composer-panel {
    position: fixed;
    z-index: 2147483647;
    pointer-events: auto;
    background: #fff;
    border: 1px solid #e5e5e5;
    border-radius: 10px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
    width: 280px;
    max-height: 80vh;
    overflow-y: auto;
    padding: 12px;
  }

  .composer-panel.right { right: 16px; top: 64px; }
  .composer-panel.left { left: 16px; top: 64px; }

  .composer-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8px;
    border-bottom: 1px solid #e5e5e5;
    margin-bottom: 8px;
  }

  .composer-panel-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #999;
  }

  .composer-section {
    margin-bottom: 12px;
  }

  .composer-section-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #999;
    margin-bottom: 6px;
  }

  .composer-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .composer-row label {
    font-size: 11px;
    color: #666;
    width: 50px;
    flex-shrink: 0;
  }

  .composer-input {
    flex: 1;
    height: 28px;
    padding: 0 8px;
    border: 1px solid #e5e5e5;
    border-radius: 6px;
    font-size: 12px;
    font-family: ui-monospace, monospace;
    background: #fafafa;
    color: #1a1a1a;
    outline: none;
  }

  .composer-input:focus {
    border-color: #3b82f6;
    background: #fff;
  }

  .composer-color-swatch {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid #e5e5e5;
    cursor: pointer;
    flex-shrink: 0;
  }

  .composer-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 500;
  }

  .composer-badge.connected {
    background: #dcfce7;
    color: #166534;
  }

  .composer-badge.disconnected {
    background: #fef2f2;
    color: #991b1b;
  }

  .composer-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-right: 4px;
  }

  .composer-status-dot.connected { background: #22c55e; }
  .composer-status-dot.disconnected { background: #ef4444; }

  .composer-changes-count {
    font-size: 10px;
    font-weight: 600;
    background: #3b82f6;
    color: #fff;
    min-width: 18px;
    height: 18px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 5px;
  }
`;

export interface MountResult {
  host: HTMLElement;
  root: ShadowRoot;
  sheet: CSSStyleSheet;
}

export function mountOverlay(): MountResult {
  const host = document.createElement("div");
  host.setAttribute("data-composer-host", "");
  host.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    z-index: 2147483647;
    pointer-events: none;
  `;

  const root = host.attachShadow({ mode: "open" });

  const sheet = new CSSStyleSheet();
  sheet.replaceSync(OVERLAY_STYLES);
  root.adoptedStyleSheets = [sheet];

  document.body.appendChild(host);

  return { host, root, sheet };
}

export function unmountOverlay(host: HTMLElement) {
  host.remove();
}
