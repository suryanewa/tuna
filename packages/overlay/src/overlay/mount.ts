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
    interpolate-size: allow-keywords;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  /* ── Toolbar ── */
  @keyframes composer-icon-in {
    from { filter: blur(4px); transform: scale(0.9); }
    to   { filter: blur(0);   transform: scale(1); }
  }

  .composer-toolbar {
    position: fixed;
    z-index: 2147483647;
    pointer-events: auto;
    background: #fff;
    border-radius: 999px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04);
    height: 44px;
    padding: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
    user-select: none;
    overflow: hidden;
    cursor: default;
    transition: padding 0.2s cubic-bezier(0.23, 1, 0.32, 1),
                gap 0.2s cubic-bezier(0.23, 1, 0.32, 1),
                width 0.2s cubic-bezier(0.23, 1, 0.32, 1),
                background 0.15s ease;
  }

  .composer-toolbar.collapsed {
    padding: 0;
    gap: 0;
    width: 44px;
    cursor: pointer;
    overflow: visible;
  }
  .composer-toolbar.collapsed:hover {
    background: #f5f5f4;
  }

  .composer-toolbar.top.right { top: 16px; right: 16px; }
  .composer-toolbar.top.left { top: 16px; left: 16px; }
  .composer-toolbar.bottom.right { bottom: 16px; right: 16px; }
  .composer-toolbar.bottom.left { bottom: 16px; left: 16px; }

  /* Collapse button (cursor-click) */
  .composer-toolbar-collapse-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    color: #1c1917;
    padding: 12px;
    width: 44px;
    height: 44px;
    background: transparent;
    flex-shrink: 0;
    transition: width 0.2s cubic-bezier(0.23, 1, 0.32, 1),
                height 0.2s cubic-bezier(0.23, 1, 0.32, 1),
                padding 0.2s cubic-bezier(0.23, 1, 0.32, 1),
                opacity 0.2s cubic-bezier(0.23, 1, 0.32, 1),
                filter 0.2s cubic-bezier(0.23, 1, 0.32, 1),
                transform 0.2s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .composer-changes-dot {
    position: absolute;
    top: 0;
    right: 0;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #2563eb;
    pointer-events: none;
  }

  /* When expanded: collapse button shrinks away */
  .composer-toolbar.expanded .composer-toolbar-collapse-btn {
    position: absolute;
    width: 0;
    height: 0;
    padding: 0;
    opacity: 0;
    filter: blur(8px);
    transform: scale(0.8);
    overflow: hidden;
    pointer-events: none;
  }

  /* Expanded inner container */
  .composer-toolbar-expanded {
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 300px;
    transition: max-width 0.2s cubic-bezier(0.23, 1, 0.32, 1),
                opacity 0.15s cubic-bezier(0.23, 1, 0.32, 1),
                gap 0.2s cubic-bezier(0.23, 1, 0.32, 1);
    overflow: hidden;
  }

  /* When collapsed: expanded items hidden */
  .composer-toolbar.collapsed .composer-toolbar-expanded {
    max-width: 0;
    opacity: 0;
    pointer-events: none;
    gap: 0;
  }

  /* Expanded action buttons */
  .composer-toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    color: #1c1917;
    padding: 6px;
    flex-shrink: 0;
    transition: background 0.12s ease;
  }

  .composer-toolbar-btn:hover { background: #f5f5f4; }

  .composer-toolbar-btn.disabled,
  .composer-toolbar-btn:disabled {
    opacity: 0.2;
    cursor: default;
    pointer-events: none;
  }

  /* Animate expanded items in */
  .composer-toolbar.expanded .composer-toolbar-expanded > :nth-child(1) {
    animation: composer-icon-in 0.15s cubic-bezier(0.23, 1, 0.32, 1) 0ms backwards;
  }
  .composer-toolbar.expanded .composer-toolbar-expanded > :nth-child(2) {
    animation: composer-icon-in 0.15s cubic-bezier(0.23, 1, 0.32, 1) 20ms backwards;
  }
  .composer-toolbar.expanded .composer-toolbar-expanded > :nth-child(3) {
    animation: composer-icon-in 0.15s cubic-bezier(0.23, 1, 0.32, 1) 40ms backwards;
  }
  .composer-toolbar.expanded .composer-toolbar-expanded > :nth-child(4) {
    animation: composer-icon-in 0.15s cubic-bezier(0.23, 1, 0.32, 1) 60ms backwards;
  }
  .composer-toolbar.expanded .composer-toolbar-expanded > :nth-child(5) {
    animation: composer-icon-in 0.15s cubic-bezier(0.23, 1, 0.32, 1) 80ms backwards;
  }

  /* Animate collapse button in */
  .composer-toolbar.collapsed .composer-toolbar-collapse-btn {
    animation: composer-icon-in 0.15s cubic-bezier(0.23, 1, 0.32, 1) backwards;
  }

  .composer-icon-flip {
    display: flex;
    transform: scaleX(-1);
  }

  .composer-edit-count {
    font-size: 13px;
    font-weight: 500;
    background: #2563eb;
    color: #fff;
    min-width: 32px;
    height: 32px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 10px;
    flex-shrink: 0;
    animation: composer-icon-in 0.25s cubic-bezier(0.2, 0, 0, 1) backwards;
  }

  /* ── Panel ── */
  .composer-panel {
    position: fixed;
    z-index: 2147483647;
    pointer-events: auto;
    background: #fff;
    border: none;
    border-radius: 16px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04);
    width: 280px;
    max-height: calc(100vh - 84px);
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: none;
  }

  .composer-panel-anim {
    display: contents;
  }

  .composer-panel-anim.entering .composer-panel {
    animation: composer-panel-in 0.15s cubic-bezier(0.23, 1, 0.32, 1) both;
  }

  .composer-panel-anim.exiting .composer-panel {
    animation: composer-panel-out 0.15s cubic-bezier(0.23, 1, 0.32, 1) both;
  }

  @keyframes composer-panel-in {
    from {
      opacity: 0;
      filter: blur(8px);
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      filter: blur(0px);
      transform: translateY(0);
    }
  }

  @keyframes composer-panel-out {
    from {
      opacity: 1;
      filter: blur(0px);
      transform: translateY(0);
    }
    to {
      opacity: 0;
      filter: blur(8px);
      transform: translateY(12px);
    }
  }

  .composer-panel.right { right: 16px; top: 16px; }
  .composer-panel.left { left: 16px; top: 16px; }

  /* Hide scrollbar */
  .composer-panel { scrollbar-width: none; }
  .composer-panel::-webkit-scrollbar { display: none; }

  /* Panel header */
  .composer-panel-header {
    position: sticky;
    top: 0;
    background: #fff;
    padding: 12px 16px;
    border-bottom: 1px solid #e7e5e4;
    z-index: 10;
  }

  .composer-el-tag {
    font-size: 13px;
    line-height: 16px;
    font-weight: 550;
    letter-spacing: 0.055px;
    color: #1c1917;
  }

  .composer-el-component {
    font-size: 11px;
    font-weight: 450;
    letter-spacing: -0.055px;
    color: #3b82f6;
    margin-top: 1px;
  }

  .composer-el-text {
    font-size: 11px;
    font-weight: 450;
    letter-spacing: -0.055px;
    color: #78716c;
    margin-top: 1px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ── Section structure (matches portfolio editor) ── */
  .composer-section {
    border-bottom: 1px solid #e7e5e4;
    user-select: none;
  }

  .composer-section:last-child { border-bottom: none; }

  .composer-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    height: 40px;
  }

  .composer-section-title {
    font-size: 13px;
    font-weight: 500;
    line-height: 20px;
    color: #1c1917;
  }

  .composer-section-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 16px;
  }

  .composer-section-row {
    padding: 0 16px;
  }

  /* Row group: wraps multiple rows with equal vertical + horizontal gaps */
  .composer-row-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0 16px;
  }

  .composer-row-group > .composer-row + .composer-row { margin-top: 4px; }

  /* ── Alignment buttons (position section) ── */
  .composer-align-row {
    display: flex;
    gap: 8px;
  }

  .composer-btn-group {
    display: flex;
    flex: 1;
    background: #f5f5f4;
    border-radius: 6px;
    overflow: hidden;
  }

  .composer-align-btn + .composer-align-btn {
    border-left: 1px solid #e7e5e4;
  }

  .composer-align-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    height: 32px;
    border: none;
    background: transparent;
    color: rgba(0, 0, 0, 0.5);
    cursor: pointer;
    padding: 0;
    transition: background 0.15s, color 0.15s;
  }

  .composer-align-btn:hover {
    background: #e7e5e4;
    color: rgba(0, 0, 0, 0.8);
  }

  .composer-align-btn:active {
    background: #d6d3d1;
  }

  /* ── Alignment grid (layout section) ── */
  .composer-alignment-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
    background: #f5f5f4;
    border-radius: 6px;
    width: 100%;
    height: 64px;
    outline: none;
  }

  .composer-alignment-grid:focus-visible {
    outline: 1px solid #000;
    outline-offset: -1px;
  }

  .composer-alignment-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
    overflow: hidden;
  }

  .composer-alignment-cell:hover {
    background: rgba(0, 0, 0, 0.04);
  }

  /* ── Grid picker ── */
  .composer-grid-picker-wrap {
    position: relative;
  }

  .composer-grid-picker-preview {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 72px;
    padding: 4px;
    background: #f5f5f4;
    border: 1px solid #e7e5e4;
    border-radius: 6px;
    cursor: pointer;
    box-sizing: border-box;
  }

  .composer-grid-picker-preview:hover {
    background: #eeeceb;
  }

  .composer-grid-picker-mini {
    display: grid;
    gap: 2px;
    flex: 1;
    height: 100%;
    position: relative;
  }

  .composer-grid-picker-mini-cell {
    background: #fff;
    border-radius: 2px;
    min-width: 0;
    min-height: 0;
  }

  .composer-grid-picker-label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 11px;
    font-family: ui-monospace, monospace;
    color: #78716c;
    white-space: nowrap;
    pointer-events: none;
  }

  .composer-grid-picker-dialog {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    padding: 8px;
    background: #fff;
    border: 1px solid #e7e5e4;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .composer-grid-picker-dialog-header {
    font-size: 11px;
    font-family: ui-monospace, monospace;
    color: #78716c;
    text-align: center;
  }

  .composer-grid-picker-grid {
    display: grid;
    grid-template-columns: repeat(10, 18px);
    grid-template-rows: repeat(10, 18px);
    gap: 2px;
    cursor: pointer;
  }

  .composer-grid-picker-cell {
    border-radius: 2px;
    background: #e7e5e4;
  }

  .composer-grid-picker-cell.selected {
    background: #3b82f6;
  }

  .composer-grid-picker-cell.preview {
    background: #93c5fd;
  }

  /* ── Constraints visual (position section) ── */
  .composer-constraints {
    display: flex;
    gap: 4px;
    align-items: center;
    width: 100%;
  }

  .composer-constraints-side {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
  }

  .composer-constraints-center {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: stretch;
  }

  .composer-pin-box {
    position: relative;
    background: #f5f5f4;
    border-radius: 6px;
    width: 100%;
    height: 64px;
  }

  .composer-pin-line {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    width: 16px;
    height: 16px;
  }

  .composer-pin-line.top {
    left: 50%;
    transform: translateX(-50%);
    top: 2px;
  }

  .composer-pin-line.right {
    left: calc(75% - 2px);
    top: 24px;
  }

  .composer-pin-line.bottom {
    left: 50%;
    transform: translateX(-50%);
    bottom: 2px;
  }

  .composer-pin-line.left {
    left: calc(25% - 14px);
    top: 24px;
  }

  .composer-pin-center-btn {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 24px;
    height: 24px;
    background: #fff;
    border: 1px solid #e7e5e4;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .composer-pin-center-btn:hover {
    border-color: #d6d3d1;
  }

  .composer-pin-center-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #3b82f6;
  }

  /* Row layout: flex with gap for side-by-side fields */
  .composer-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  /* Direct children in a row get flex: 1 */
  .composer-row > .composer-prop,
  .composer-row > .composer-combo,
  .composer-row > .composer-select,
  .composer-row > .composer-text-input,
  .composer-row > .composer-font-input { flex: 1; }

  /* Field: flex-1 column with label above input */
  .composer-field {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .composer-field-label {
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0.045px;
    color: rgba(0, 0, 0, 0.5);
    line-height: 16px;
  }

  /* Group label: single label above a set of related inputs */
  .composer-group-label {
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0.045px;
    color: rgba(0, 0, 0, 0.5);
    line-height: 16px;
    padding: 0 16px;
  }

  /* Group label inside a RowGroup (no extra horizontal padding) */
  .composer-group-label-inline {
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0.045px;
    color: rgba(0, 0, 0, 0.5);
    line-height: 16px;
  }

  /* Property cell — matches portfolio NumberInput */
  .composer-prop {
    display: flex;
    align-items: center;
    gap: 0;
    height: 32px;
    padding: 0;
    border-radius: 6px;
    background: #f5f5f4;
    border: none;
    min-width: 0;
    overflow: hidden;
    position: relative;
    transition: background-color 0.15s ease;
  }

  .composer-prop:hover { background: #e7e5e4; }
  .composer-prop:focus-within {
    outline: 1px solid #1c1917;
    outline-offset: -1px;
    background: #f5f5f4;
  }

  .composer-prop-label {
    position: absolute;
    left: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 450;
    letter-spacing: -0.055px;
    color: rgba(0, 0, 0, 0.3);
    flex-shrink: 0;
    user-select: none;
    cursor: ew-resize;
    z-index: 1;
  }

  .composer-prop-input {
    flex: 1;
    min-width: 0;
    width: 100%;
    height: 100%;
    border: none;
    background: transparent;
    font-size: 11px;
    font-weight: 450;
    letter-spacing: -0.055px;
    font-family: inherit;
    color: #1c1917;
    outline: none;
    padding: 0 6px 0 32px;
  }

  .composer-prop-input::selection { background: #bfdbfe; }
  .composer-prop-input:focus { outline: none; }

  /* ── Color Input (split: [swatch|hex] [opacity%]) ── */
  .composer-color-row {
    display: flex;
    gap: 1px;
    flex: 1;
    min-width: 0;
  }

  .composer-color-hex-section {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
    height: 32px;
    background: #f5f5f4;
    border-radius: 6px 0 0 6px;
  }

  .composer-color-swatch {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    cursor: pointer;
  }

  .composer-color-swatch-inner {
    width: 14px;
    height: 14px;
    border-radius: 2px;
  }

  .composer-color-hex-input {
    flex: 1;
    min-width: 0;
    height: 32px;
    background: transparent;
    border: none;
    font-family: inherit;
    font-size: 11px;
    font-weight: 500;
    color: #1c1917;
    outline: none;
    padding: 0;
  }

  .composer-color-hex-input::selection { background: #bfdbfe; }

  .composer-color-opacity-section {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 8px 0 4px;
    height: 32px;
    background: #f5f5f4;
    border-radius: 0 6px 6px 0;
    flex-shrink: 0;
  }

  .composer-color-opacity-input {
    width: 28px;
    height: 32px;
    background: transparent;
    border: none;
    font-family: inherit;
    font-size: 11px;
    font-weight: 500;
    color: #1c1917;
    text-align: center;
    outline: none;
    padding: 0;
    -moz-appearance: textfield;
  }

  .composer-color-opacity-input::-webkit-outer-spin-button,
  .composer-color-opacity-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .composer-color-opacity-unit {
    font-size: 10px;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.4);
  }

  /* ── Color Picker Panel ── */
  .composer-color-picker-panel {
    background: #fff;
    border-radius: 12px;
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.12),
      0 8px 24px rgba(0, 0, 0, 0.08),
      0 0 0 1px rgba(0, 0, 0, 0.06);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .composer-cp-sv {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    cursor: crosshair;
    touch-action: none;
    overflow: hidden;
  }

  .composer-cp-sv-white {
    position: absolute;
    inset: 0;
    background: linear-gradient(to right, #fff, transparent);
  }

  .composer-cp-sv-black {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent, #000);
  }

  .composer-cp-handle {
    position: absolute;
    pointer-events: none;
    transform: translate(-50%, -50%);
    will-change: transform;
  }

  .composer-cp-handle-inner {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow:
      0 0 0.5px rgba(0, 0, 0, 0.2),
      0 2px 6px rgba(0, 0, 0, 0.12);
  }

  .composer-cp-sliders {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
  }

  .composer-cp-preview-wrap {
    position: relative;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    flex-shrink: 0;
    overflow: hidden;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
  }

  .composer-cp-preview-checker {
    position: absolute;
    inset: 0;
    background-image: repeating-conic-gradient(#e0e0e0 0% 25%, #fff 0% 50%);
    background-size: 8px 8px;
  }

  .composer-cp-preview {
    position: absolute;
    inset: 0;
    border-radius: 50%;
  }

  .composer-cp-slider-tracks {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  .composer-cp-hue {
    position: relative;
    height: 14px;
    border-radius: 7px;
    background: linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000);
    cursor: pointer;
    touch-action: none;
    overflow: visible;
    box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.1);
  }

  .composer-cp-alpha {
    position: relative;
    height: 14px;
    border-radius: 7px;
    cursor: pointer;
    touch-action: none;
    overflow: visible;
    box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.1);
  }

  .composer-cp-alpha-checker {
    position: absolute;
    inset: 0;
    background-image: repeating-conic-gradient(#e0e0e0 0% 25%, #fff 0% 50%);
    background-size: 8px 8px;
    border-radius: 7px;
  }

  .composer-cp-alpha-gradient {
    position: absolute;
    inset: 0;
    border-radius: 7px;
  }

  .composer-cp-inputs {
    display: flex;
    gap: 4px;
    padding: 0 12px 10px;
  }

  .composer-cp-input-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .composer-cp-input-group:first-child {
    flex: 1.8;
  }

  .composer-cp-label {
    font-size: 9px;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding-left: 2px;
  }

  .composer-cp-input {
    height: 32px;
    border-radius: 4px;
    background: #f5f5f4;
    border: none;
    font-family: inherit;
    font-size: 11px;
    font-weight: 500;
    color: #1c1917;
    padding: 0 6px;
    outline: none;
    width: 100%;
    min-width: 0;
  }

  .composer-cp-input:focus {
    outline: none;
    box-shadow: 0 0 0 1.5px rgba(59, 130, 246, 0.5);
  }

  .composer-cp-input::selection { background: #bfdbfe; }

  /* ── Gradient Editor ── */
  .composer-gradient-editor {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 4px 16px;
  }

  .composer-gradient-bar-wrap {
    position: relative;
    height: 56px;
    cursor: crosshair;
  }

  .composer-gradient-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 32px;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid rgba(0,0,0,0.1);
  }

  .composer-gradient-bar-checker {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%),
      linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%);
    background-size: 6px 6px;
    background-position: 0 0, 3px 3px;
  }

  .composer-gradient-bar-fill {
    position: absolute;
    inset: 0;
  }

  .composer-gradient-stop-handle {
    position: absolute;
    top: 14px;
    transform: translateX(-50%);
    cursor: grab;
    touch-action: none;
  }

  .composer-gradient-stop-handle:active { cursor: grabbing; }

  .composer-gradient-stop-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    filter: drop-shadow(0 0 0.5px rgba(0,0,0,0.18)) drop-shadow(0 2px 6px rgba(0,0,0,0.12));
  }

  .composer-gradient-stop-chit {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 5px;
  }

  .composer-gradient-stop-chit-color {
    width: 14px;
    height: 14px;
    border-radius: 2px;
    box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1);
  }

  .composer-gradient-stop-caret {
    width: 8px;
    height: 4px;
    clip-path: polygon(0 0, 100% 0, 50% 100%);
    margin-top: -1px;
  }

  .composer-gradient-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .composer-gradient-angle-input {
    width: 64px;
    height: 32px;
    border-radius: 6px;
    background: #f5f5f4;
    border: none;
    font-family: inherit;
    font-size: 11px;
    font-weight: 450;
    letter-spacing: 0.055px;
    color: #1c1917;
    padding: 0 8px;
    text-align: left;
  }

  .composer-gradient-angle-input:focus {
    outline: none;
    box-shadow: 0 0 0 1.5px rgba(59, 130, 246, 0.5);
  }

  .composer-gradient-actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .composer-gradient-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    border-radius: 6px;
    color: #78716c;
    cursor: pointer;
    transition: background-color 0.08s ease, color 0.08s ease;
  }

  .composer-gradient-action-btn:hover { background: #f5f5f4; color: #1c1917; }
  .composer-gradient-action-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .composer-gradient-action-btn:disabled:hover { background: transparent; color: #78716c; }

  .composer-gradient-stops-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 0;
  }

  .composer-gradient-stops-label {
    font-size: 11px;
    font-weight: 550;
    letter-spacing: 0.055px;
    color: #1c1917;
  }

  .composer-gradient-stops-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .composer-gradient-stop-row {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    padding: 2px 0;
  }

  .composer-gradient-stop-pos {
    position: relative;
    display: flex;
    align-items: center;
    width: 48px;
    flex-shrink: 0;
  }

  .composer-gradient-stop-pos-input {
    width: 100%;
    height: 32px;
    border-radius: 6px;
    background: #f5f5f4;
    border: none;
    font-family: inherit;
    font-size: 11px;
    font-weight: 450;
    letter-spacing: 0.055px;
    color: #1c1917;
    padding: 0 18px 0 6px;
    text-align: left;
  }

  .composer-gradient-stop-pos-input:focus {
    outline: none;
    box-shadow: 0 0 0 1.5px rgba(59, 130, 246, 0.5);
  }

  .composer-gradient-stop-pos-unit {
    position: absolute;
    right: 6px;
    font-size: 11px;
    color: #a8a29e;
    pointer-events: none;
  }

  .composer-gradient-stop-color {
    flex: 1;
    min-width: 0;
  }

  /* ── SelectInput ── */
  .composer-select {
    position: relative;
    min-width: 0;
    overflow: visible;
  }

  .composer-select-button {
    display: flex;
    align-items: center;
    width: 100%;
    height: 32px;
    border-radius: 6px;
    background: #f5f5f4;
    border: none;
    cursor: pointer;
    font-family: inherit;
    padding: 0;
    transition: background-color 0.15s ease;
    position: relative;
  }

  .composer-select-button:hover { background: #e7e5e4; }
  .composer-select-button:focus-visible {
    outline: 1px solid #1c1917;
    outline-offset: -1px;
  }

  .composer-select-label {
    position: absolute;
    left: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 450;
    letter-spacing: -0.055px;
    color: rgba(0, 0, 0, 0.3);
    flex-shrink: 0;
  }

  .composer-select-value {
    flex: 1;
    min-width: 0;
    font-size: 11px;
    font-weight: 450;
    letter-spacing: -0.055px;
    color: #1c1917;
    text-align: left;
    padding-left: 32px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .composer-select-chevron {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #78716c;
    flex-shrink: 0;
  }

  .composer-select-dropdown-anchor {
    position: fixed;
    z-index: 2147483647;
    width: max-content;
  }

  /* ── Slider ── */
  .composer-slider {
    position: relative;
    height: 32px;
    border-radius: 6px;
    background: #f5f5f4;
    cursor: ew-resize;
    user-select: none;
    overflow: hidden;
    transition: background-color 0.15s ease;
  }

  .composer-slider:hover { background: #e7e5e4; }
  .composer-slider:focus-visible { outline: 1px solid #1c1917; outline-offset: -1px; }

  .composer-slider-fill {
    position: absolute;
    inset: 0;
    right: auto;
    background: #ebebeb;
    pointer-events: none;
  }

  .composer-slider-indicator {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 1px;
    height: 4px;
    border-radius: 1px;
    background: rgba(0, 0, 0, 0.12);
    pointer-events: none;
  }

  .composer-slider-handle {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 2px;
    height: 16px;
    border-radius: 1px;
    background: #fff;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1);
    pointer-events: none;
    margin-left: -1px;
  }

  .composer-slider-labels {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 6px;
    pointer-events: none;
    overflow: hidden;
    white-space: nowrap;
  }

  .composer-slider-label {
    font-size: 11px;
    font-weight: 450;
    letter-spacing: -0.055px;
    color: #78716c;
  }

  .composer-slider-value {
    font-size: 11px;
    font-weight: 450;
    letter-spacing: -0.055px;
    font-family: inherit;
    color: #1c1917;
  }

  /* ── SegmentedControl ── */
  .composer-segmented {
    display: flex;
    height: 32px;
    background: #f5f5f4;
    border-radius: 6px;
    overflow: hidden;
    flex: 1;
  }

  .composer-segmented-item {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    height: 32px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    padding: 0;
    color: rgba(0, 0, 0, 0.4);
    transition: color 0.1s;
  }

  .composer-segmented-item:hover:not(.disabled) { color: rgba(0, 0, 0, 0.7); }

  .composer-segmented-item.selected {
    background: #fff;
    border-color: rgba(0, 0, 0, 0.1);
    color: #1c1917;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  }

  .composer-segmented-item.disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .composer-segmented-item svg {
    width: 16px;
    height: 16px;
  }

  /* ── FontInput ── */
  .composer-font-input {
    display: flex;
    align-items: center;
    height: 32px;
    border-radius: 6px;
    background: #f5f5f4;
    min-width: 0;
    overflow: hidden;
    position: relative;
    transition: background-color 0.15s ease;
  }

  .composer-font-input:hover { background: #e7e5e4; }
  .composer-font-input:focus-within {
    outline: 1px solid #1c1917;
    outline-offset: -1px;
    background: #f5f5f4;
  }

  .composer-font-input-field {
    flex: 1;
    min-width: 0;
    width: 100%;
    height: 100%;
    border: none;
    background: transparent;
    font-size: 11px;
    font-weight: 450;
    letter-spacing: -0.055px;
    color: #1c1917;
    outline: none;
    padding: 0 8px;
  }

  /* ── TextInput ── */
  .composer-text-input {
    display: flex;
    align-items: center;
    height: 32px;
    border-radius: 6px;
    background: #f5f5f4;
    min-width: 0;
    overflow: hidden;
    position: relative;
    transition: background-color 0.15s ease;
  }

  .composer-text-input:hover { background: #e7e5e4; }
  .composer-text-input:focus-within {
    outline: 1px solid #1c1917;
    outline-offset: -1px;
    background: #f5f5f4;
  }

  .composer-text-input-field {
    flex: 1;
    min-width: 0;
    width: 100%;
    height: 100%;
    border: none;
    background: transparent;
    font-size: 11px;
    font-weight: 450;
    letter-spacing: -0.055px;
    font-family: inherit;
    color: #1c1917;
    outline: none;
    padding: 0 8px;
  }

  .composer-text-input-field::selection { background: #bfdbfe; }
  .composer-text-input-field:focus { outline: none; }

  /* ── ComboInput ── */
  .composer-combo {
    display: flex;
    align-items: center;
    height: 32px;
    min-width: 0;
    overflow: visible;
    position: relative;
    gap: 1px;
  }

  .composer-combo-label {
    position: absolute;
    left: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 450;
    letter-spacing: -0.055px;
    color: rgba(0, 0, 0, 0.3);
    flex-shrink: 0;
    user-select: none;
    cursor: ew-resize;
    z-index: 1;
  }

  .composer-combo-input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: none;
    background: #f5f5f4;
    border-radius: 6px 0 0 6px;
    font-size: 11px;
    font-weight: 450;
    letter-spacing: -0.055px;
    font-family: inherit;
    color: #1c1917;
    outline: none;
    padding: 0 6px 0 32px;
    transition: background-color 0.15s ease;
  }

  .composer-combo-input:hover { background: #e7e5e4; }
  .composer-combo-input:focus {
    outline: 1px solid #1c1917;
    outline-offset: -1px;
    background: #f5f5f4;
  }
  .composer-combo-input::selection { background: #bfdbfe; }

  .composer-combo-trigger {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f5f4;
    border-radius: 0 6px 6px 0;
    border: none;
    cursor: pointer;
    color: #78716c;
    flex-shrink: 0;
    padding: 0;
    transition: background-color 0.15s ease, color 0.12s ease;
  }

  .composer-combo-trigger:hover { background: #e7e5e4; color: #1c1917; }
  .composer-combo-trigger:focus-visible {
    outline: 1px solid #1c1917;
    outline-offset: -1px;
  }

  .composer-combo-dropdown-anchor {
    position: fixed;
    z-index: 2147483647;
  }

  /* ── Dropdown Menu ── */
  .composer-menu-wrapper {
    position: relative;
    width: fit-content;
    min-width: max(120px, 100%);
    border-radius: 12px;
    overflow: hidden;
    user-select: none;
    box-shadow: 0 0 0.5px rgba(0,0,0,0.12), 0 10px 16px rgba(0,0,0,0.12), 0 2px 5px rgba(0,0,0,0.15);
  }

  .composer-menu-scroll {
    max-height: 400px;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 6px 0;
    background: #1c1917;
    scrollbar-width: none;
    overscroll-behavior: none;
  }

  .composer-menu-scroll::-webkit-scrollbar { display: none; }

  .composer-menu-separator {
    height: 16px;
    display: flex;
    align-items: center;
  }

  .composer-menu-separator-line {
    width: 100%;
    height: 1px;
    background: #292524;
  }

  .composer-menu-heading {
    padding: 4px 16px;
    font-size: 11px;
    font-weight: 450;
    letter-spacing: 0.055px;
    line-height: 16px;
    color: rgba(255,255,255,0.4);
  }

  .composer-menu-item-wrap {
    padding: 0 6px;
  }

  .composer-menu-item {
    position: relative;
    width: 100%;
    display: flex;
    align-items: center;
    min-height: 28px;
    padding: 4px 24px 4px 8px;
    border: none;
    background: transparent;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 450;
    letter-spacing: 0.055px;
    font-family: inherit;
    color: #fff;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.08s ease;
  }

  .composer-menu-item.has-check { padding-left: 28px; }

  .composer-menu-item.highlighted { background: rgba(255,255,255,0.1); }
  .composer-menu-item.selected { color: #fff; }
  .composer-menu-item.disabled { opacity: 0.5; cursor: not-allowed; }

  .composer-menu-check {
    position: absolute;
    left: 4px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
  }

  .composer-menu-item-label {
    line-height: 16px;
    white-space: nowrap;
  }

  .composer-menu-item-shortcut {
    margin-left: auto;
    padding-left: 16px;
    color: rgba(255,255,255,0.7);
    white-space: nowrap;
  }

  .composer-menu-empty {
    padding: 4px 16px;
    font-size: 11px;
    color: rgba(255,255,255,0.4);
  }

  .composer-menu-scroll-indicator {
    position: absolute;
    left: 0;
    right: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 24px;
    background: #1c1917;
    cursor: default;
    color: #fff;
  }

  .composer-menu-scroll-indicator.top {
    top: 0;
    border-radius: 12px 12px 0 0;
  }

  .composer-menu-scroll-indicator.bottom {
    bottom: 0;
    border-radius: 0 0 12px 12px;
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
