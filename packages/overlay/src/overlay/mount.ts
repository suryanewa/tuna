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

  * { box-sizing: border-box; margin: 0; padding: 0; }

  /* ── Toolbar ── */
  .composer-toolbar {
    position: fixed;
    z-index: 2147483647;
    pointer-events: auto;
    background: #fff;
    border: 1px solid #e2e2e2;
    border-radius: 10px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04);
    padding: 6px;
    display: flex;
    align-items: center;
    gap: 4px;
    user-select: none;
  }

  .composer-toolbar.top.right { top: 16px; right: 16px; }
  .composer-toolbar.top.left { top: 16px; left: 16px; }
  .composer-toolbar.bottom.right { bottom: 16px; right: 16px; }
  .composer-toolbar.bottom.left { bottom: 16px; left: 16px; }

  .composer-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    color: #888;
    transition: all 0.12s ease;
  }

  .composer-btn:hover { background: #f0f0f0; color: #333; }
  .composer-btn.active { background: #3b82f6; color: #fff; }
  .composer-btn.active:hover { background: #2563eb; }

  .composer-divider {
    width: 1px;
    height: 18px;
    background: #e5e5e5;
    margin: 0 2px;
  }

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

  .composer-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 500;
  }
  .composer-badge.connected { background: #dcfce7; color: #166534; }
  .composer-badge.disconnected { background: #f5f5f5; color: #999; }
  .composer-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-right: 4px;
  }
  .composer-status-dot.connected { background: #22c55e; }
  .composer-status-dot.disconnected { background: #ccc; }

  /* ── Panel ── */
  .composer-panel {
    position: fixed;
    z-index: 2147483647;
    pointer-events: auto;
    background: #fff;
    border: 1px solid #e2e2e2;
    border-radius: 10px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.04);
    width: 260px;
    max-height: calc(100vh - 80px);
    overflow-y: auto;
    overflow-x: hidden;
  }

  .composer-panel.right { right: 16px; top: 60px; }
  .composer-panel.left { left: 16px; top: 60px; }

  /* Scrollbar */
  .composer-panel::-webkit-scrollbar { width: 4px; }
  .composer-panel::-webkit-scrollbar-track { background: transparent; }
  .composer-panel::-webkit-scrollbar-thumb { background: #ddd; border-radius: 2px; }
  .composer-panel::-webkit-scrollbar-thumb:hover { background: #bbb; }

  /* Panel header */
  .composer-panel-header {
    position: sticky;
    top: 0;
    background: #fff;
    padding: 10px 12px 8px;
    border-bottom: 1px solid #f0f0f0;
    z-index: 1;
  }

  .composer-el-tag {
    font-size: 12px;
    font-weight: 600;
    color: #1a1a1a;
  }

  .composer-el-component {
    font-size: 11px;
    color: #3b82f6;
    font-weight: 500;
    margin-top: 2px;
  }

  .composer-el-text {
    font-size: 11px;
    color: #999;
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Section */
  .composer-section {
    padding: 8px 12px;
    border-bottom: 1px solid #f0f0f0;
  }

  .composer-section:last-child { border-bottom: none; }

  .composer-section-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #999;
    margin-bottom: 8px;
  }

  /* Property grid: 2 columns */
  .composer-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }

  .composer-grid.single {
    grid-template-columns: 1fr;
  }

  /* Property cell */
  .composer-prop {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 28px;
    padding: 0 6px;
    border-radius: 5px;
    background: #fafafa;
    border: 1px solid transparent;
    transition: border-color 0.12s ease;
  }

  .composer-prop:hover { border-color: #e0e0e0; }
  .composer-prop:focus-within { border-color: #3b82f6; background: #fff; }

  .composer-prop-label {
    font-size: 10px;
    color: #999;
    flex-shrink: 0;
    min-width: 20px;
    user-select: none;
    cursor: ew-resize;
  }

  .composer-prop-input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: none;
    background: transparent;
    font-size: 11px;
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    color: #1a1a1a;
    outline: none;
    padding: 0;
  }

  .composer-prop-input::selection { background: #bfdbfe; }

  /* Color property */
  .composer-prop.color {
    gap: 6px;
  }

  .composer-color-swatch {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    cursor: pointer;
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
  }

  /* Checkerboard for transparent colors */
  .composer-color-swatch::before {
    content: '';
    position: absolute;
    inset: 0;
    background: conic-gradient(#ddd 25%, #fff 25% 50%, #ddd 50% 75%, #fff 75%) 0 0 / 8px 8px;
    z-index: 0;
  }

  .composer-color-swatch-fill {
    position: absolute;
    inset: 0;
    z-index: 1;
  }

  .composer-color-picker {
    position: absolute;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }

  /* Full-width prop (for long values like box-shadow) */
  .composer-prop.full {
    grid-column: 1 / -1;
  }

  /* Select input */
  .composer-prop-select {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: none;
    background: transparent;
    font-size: 11px;
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    color: #1a1a1a;
    outline: none;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
  }
`;

export interface MountResult {
  host: HTMLElement;
  root: ShadowRoot;
  /** Container inside shadow root — use this as the React portal target */
  container: HTMLDivElement;
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

  // React createPortal needs a real DOM element, not a ShadowRoot
  const container = document.createElement("div");
  container.setAttribute("data-composer-container", "");
  root.appendChild(container);

  document.body.appendChild(host);

  return { host, root, container, sheet };
}

export function unmountOverlay(host: HTMLElement) {
  host.remove();
}
