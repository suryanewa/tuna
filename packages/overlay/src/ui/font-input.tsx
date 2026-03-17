/**
 * FontInput — font family picker using FloatingDialog.
 * Shows project fonts (from stylesheets), system fonts (via Local Font Access API),
 * and generic fallbacks. Each font rendered in its own typeface.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { FloatingDialog } from "./floating-dialog";
import { ChevronDown } from "./icons";
import { claimDialog, releaseDialog } from "./dialog-singleton";

const FALLBACK_FONTS = [
  "system-ui",
  "sans-serif",
  "serif",
  "monospace",
];

/** Scan stylesheets to find font families used in the project */
function detectProjectFonts(): string[] {
  const fonts = new Set<string>();
  try {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (!(rule instanceof CSSStyleRule)) continue;
          const ff = rule.style.getPropertyValue("font-family");
          if (!ff) continue;
          for (const part of ff.split(",")) {
            const name = part.trim().replace(/^["']|["']$/g, "");
            if (name && !FALLBACK_FONTS.includes(name)) {
              fonts.add(name);
            }
          }
        }
      } catch { /* cross-origin sheet */ }
    }
  } catch { /* stylesheet access not supported */ }
  return Array.from(fonts).sort();
}

let projectFontsCache: string[] | null = null;
function getProjectFonts(): string[] {
  if (!projectFontsCache) {
    projectFontsCache = detectProjectFonts();
    setTimeout(() => { projectFontsCache = null; }, 10000);
  }
  return projectFontsCache;
}

/** Query local system fonts via the Local Font Access API */
async function queryLocalFonts(): Promise<string[]> {
  try {
    if (!('queryLocalFonts' in window)) return [];
    const fonts = await (window as any).queryLocalFonts();
    const families = new Set<string>();
    for (const font of fonts) {
      families.add(font.family);
    }
    return Array.from(families).sort();
  } catch {
    return [];
  }
}

/** Extract the primary font name from a CSS font-family stack */
function extractPrimaryFont(fontFamily: string): string {
  if (!fontFamily) return "";
  const first = fontFamily.split(",")[0].trim();
  return first.replace(/^["']|["']$/g, "");
}

export interface FontInputProps {
  prop: string;
  value: string | undefined;
  onChange: (prop: string, value: string) => void;
}

export function FontInput({ prop, value, onChange }: FontInputProps) {
  const primaryFont = extractPrimaryFont(value || "");
  const [localValue, setLocalValue] = useState(primaryFont);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [search, setSearch] = useState("");
  const [systemFonts, setSystemFonts] = useState<string[] | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stableCloseRef = useRef(() => setPickerOpen(false));

  // Sync from parent
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setLocalValue(extractPrimaryFont(value || ""));
  }

  // Build font sections
  const projectFonts = useMemo(() => getProjectFonts(), []);

  const filteredProject = search
    ? projectFonts.filter(f => f.toLowerCase().includes(search.toLowerCase()))
    : projectFonts;

  const filteredSystem = search && systemFonts
    ? systemFonts.filter(f => f.toLowerCase().includes(search.toLowerCase()) && !projectFonts.some(p => p.toLowerCase() === f.toLowerCase()))
    : (systemFonts || []).filter(f => !projectFonts.some(p => p.toLowerCase() === f.toLowerCase()));

  const filteredFallbacks = search
    ? FALLBACK_FONTS.filter(f => f.toLowerCase().includes(search.toLowerCase()))
    : FALLBACK_FONTS;

  // All fonts flat for keyboard navigation
  const allFiltered = [...filteredProject, ...filteredSystem, ...filteredFallbacks];

  // Open the picker
  const openPicker = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (pickerOpen) {
      releaseDialog(stableCloseRef.current);
      setPickerOpen(false);
      return;
    }
    const row = el.closest(".retune-row");
    const rect = row ? row.getBoundingClientRect() : el.getBoundingClientRect();
    setAnchorRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    setPickerOpen(true);
    setSearch("");
    setHighlightedIndex(-1);
    claimDialog(stableCloseRef.current);
  }, [pickerOpen]);

  const closePicker = useCallback(() => {
    releaseDialog(stableCloseRef.current);
    setPickerOpen(false);
    setSearch("");
  }, []);

  const handleSelect = useCallback((fontName: string) => {
    setLocalValue(fontName);
    onChange(prop, fontName);
    closePicker();
  }, [prop, onChange, closePicker]);

  // Load system fonts on demand
  const loadSystemFonts = useCallback(async () => {
    if (systemFonts !== null) return; // already loaded or attempted
    const fonts = await queryLocalFonts();
    setSystemFonts(fonts);
  }, [systemFonts]);

  // Native click handler for font items (Shadow DOM compatible)
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const handleClick = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      const item = target.closest<HTMLElement>("[data-font-name]");
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      const name = item.dataset.fontName;
      if (name === "__load_system") { loadSystemFonts(); return; }
      if (name) handleSelect(name);
    };
    list.addEventListener("pointerdown", handleClick);
    return () => list.removeEventListener("pointerdown", handleClick);
  }, [pickerOpen, handleSelect, loadSystemFonts]);

  // Keyboard navigation
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const count = allFiltered.length;
    if (count === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % count);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex(prev => (prev <= 0 ? count - 1 : prev - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < count) {
        handleSelect(allFiltered[highlightedIndex]);
      }
    }
  }, [allFiltered, highlightedIndex, handleSelect]);

  // Auto-scroll highlighted item
  useEffect(() => {
    if (highlightedIndex < 0) return;
    const list = listRef.current;
    if (!list) return;
    const item = list.querySelector(`[data-font-index="${highlightedIndex}"]`);
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);


  // Find portal target for the floating dialog
  const portalTarget = containerRef.current?.getRootNode() instanceof ShadowRoot
    ? (containerRef.current.getRootNode() as ShadowRoot).querySelector("[data-retune-container]") as HTMLElement
    : null;

  // Track flat index for highlighting
  let flatIndex = 0;

  return (
    <div className="retune-font-input" ref={containerRef}>
      <button
        type="button"
        className="retune-font-input-trigger"
        onClick={openPicker}
      >
        <span className="retune-font-input-value" style={{ fontFamily: primaryFont || undefined }}>{primaryFont || "–"}</span>
        <ChevronDown />
      </button>
      {pickerOpen && anchorRect && portalTarget && createPortal(
        <FloatingDialog
          title="Fonts"
          onClose={closePicker}
          anchorRect={anchorRect}
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search fonts...",
            onKeyDown: handleSearchKeyDown,
          }}
          maxHeight={400}
          minHeight={400}
        >
          <div ref={listRef} className="retune-font-list">
            {/* Project fonts */}
            {filteredProject.length > 0 && (
              <>
                <div className="retune-font-section-title">Project fonts</div>
                {filteredProject.map(font => {
                  const idx = flatIndex++;
                  return (
                    <div
                      key={font}
                      className={`retune-font-item${font === primaryFont ? " retune-font-item-active" : ""}${idx === highlightedIndex ? " retune-font-item-highlighted" : ""}`}
                      data-font-name={font} title={font}
                      data-font-index={idx}
                      style={{ fontFamily: font }}
                    >
                      {font}
                    </div>
                  );
                })}
              </>
            )}

            {/* System fonts */}
            {systemFonts === null ? (
              <div className="retune-font-system-prompt">
                <button
                  className="retune-font-system-btn"
                  data-font-name="__load_system"
                >
                  Show system fonts
                </button>
              </div>
            ) : filteredSystem.length > 0 ? (
              <>
                <div className="retune-font-section-title">System fonts</div>
                {filteredSystem.map(font => {
                  const idx = flatIndex++;
                  return (
                    <div
                      key={font}
                      className={`retune-font-item${font === primaryFont ? " retune-font-item-active" : ""}${idx === highlightedIndex ? " retune-font-item-highlighted" : ""}`}
                      data-font-name={font} title={font}
                      data-font-index={idx}
                      style={{ fontFamily: font }}
                    >
                      {font}
                    </div>
                  );
                })}
              </>
            ) : null}

            {/* Fallback fonts */}
            {filteredFallbacks.length > 0 && (
              <>
                <div className="retune-font-section-title">Generic</div>
                {filteredFallbacks.map(font => {
                  const idx = flatIndex++;
                  return (
                    <div
                      key={font}
                      className={`retune-font-item${font === primaryFont ? " retune-font-item-active" : ""}${idx === highlightedIndex ? " retune-font-item-highlighted" : ""}`}
                      data-font-name={font} title={font}
                      data-font-index={idx}
                      style={{ fontFamily: font }}
                    >
                      {font}
                    </div>
                  );
                })}
              </>
            )}

            {allFiltered.length === 0 && (
              <div className="retune-font-empty">No fonts found</div>
            )}
          </div>
        </FloatingDialog>,
        portalTarget,
      )}
    </div>
  );
}
