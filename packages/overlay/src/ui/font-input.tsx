/**
 * FontInput — font family picker using FloatingDialog.
 * Shows project fonts (from stylesheets), system fonts (via Local Font Access API),
 * and generic fallbacks. Each font rendered in its own typeface.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { FloatingDialog } from "./floating-dialog";
import { SelectInput } from "./select-input";
import { ChevronDown } from "./icons";
import { Tooltip } from "./tooltip";
import { claimDialog, releaseDialog } from "./dialog-singleton";
import { ChangeIndicator } from "./change-indicator";
import { isMixedValue, MIXED_LABEL } from "./mixed-value";

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
          if (!ff || ff.trim().startsWith("var(")) continue;
          for (const part of ff.split(",")) {
            const name = part.trim().replace(/^["']|["']$/g, "");
            if (name.startsWith("var(")) continue;
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
  /** Whether this property has been changed from its original value */
  isChanged?: boolean;
  /** Reset this property to its original value */
  onReset?: () => void;
}

export function FontInput({ prop, value, onChange, isChanged, onReset }: FontInputProps) {
  const primaryFont = isMixedValue(value) ? MIXED_LABEL : extractPrimaryFont(value || "");
  const [localValue, setLocalValue] = useState(primaryFont);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [search, setSearch] = useState("");
  const [systemFonts, setSystemFonts] = useState<string[] | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [fontCategory, setFontCategory] = useState<"all" | "project" | "system" | "generic">("all");
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stableCloseRef = useRef(() => setPickerOpen(false));

  const [fontPermissionDenied, setFontPermissionDenied] = useState(false);

  // Auto-load system fonts if permission already granted, or detect denied
  useEffect(() => {
    if (systemFonts !== null) return;
    if (!('queryLocalFonts' in window)) return;
    try {
      navigator.permissions.query({ name: "local-fonts" as PermissionName }).then(result => {
        if (result.state === "granted") {
          queryLocalFonts().then(fonts => setSystemFonts(fonts));
        } else if (result.state === "denied") {
          setSystemFonts([]);
          setFontPermissionDenied(true);
        }
      }).catch(() => {}); // permission query not supported
    } catch {}
  }, [systemFonts]);

  // Sync from parent without setState during render (React 19)
  useEffect(() => {
    setLocalValue(isMixedValue(value) ? MIXED_LABEL : extractPrimaryFont(value || ""));
  }, [value]);

  // Build font sections
  const projectFonts = useMemo(() => getProjectFonts(), []);

  // Deduplicated system fonts (exclude project fonts)
  const deduplicatedSystem = useMemo(() =>
    (systemFonts || []).filter(f => !projectFonts.some(p => p.toLowerCase() === f.toLowerCase())),
    [systemFonts, projectFonts]
  );

  // Apply search + category filter
  const matchesSearch = (f: string) => !search || f.toLowerCase().includes(search.toLowerCase());

  const filteredProject = (fontCategory === "all" || fontCategory === "project")
    ? projectFonts.filter(matchesSearch) : [];

  const filteredSystem = (fontCategory === "all" || fontCategory === "system")
    ? deduplicatedSystem.filter(matchesSearch) : [];

  const filteredFallbacks = (fontCategory === "all" || fontCategory === "generic")
    ? FALLBACK_FONTS.filter(matchesSearch) : [];

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
    try {
      const fonts = await queryLocalFonts();
      setSystemFonts(fonts);
    } catch {
      // Permission denied or API error — mark as empty so button doesn't loop
      setSystemFonts([]);
      setFontPermissionDenied(true);
    }
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
      <ChangeIndicator isChanged={isChanged ?? false} onReset={onReset ?? (() => {})} />
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
          <div className="retune-font-filter">
            <SelectInput
              prop="__fontCategory"
              value={fontCategory}
              options={["all", "project", "system", "generic"]}
              onChange={(_, val) => setFontCategory(val as any)}
            />
          </div>
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
                      data-font-name={font}
                      data-font-index={idx}
                      style={{ fontFamily: font }}
                    >
                      {font}
                    </div>
                  );
                })}
              </>
            )}

            {/* System fonts (loaded) */}
            {filteredSystem.length > 0 && (
              <>
                <div className="retune-font-section-title">System fonts</div>
                {filteredSystem.map(font => {
                  const idx = flatIndex++;
                  return (
                    <div
                      key={font}
                      className={`retune-font-item${font === primaryFont ? " retune-font-item-active" : ""}${idx === highlightedIndex ? " retune-font-item-highlighted" : ""}`}
                      data-font-name={font}
                      data-font-index={idx}
                      style={{ fontFamily: font }}
                    >
                      {font}
                    </div>
                  );
                })}
              </>
            )}

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
                      data-font-name={font}
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

            {/* Load system fonts button or denied message */}
            {(fontCategory === "all" || fontCategory === "system") && (
              systemFonts === null ? (
                <div className="retune-font-system-prompt">
                  <button
                    className="retune-font-system-btn"
                    data-font-name="__load_system"
                  >
                    Load system fonts
                  </button>
                </div>
              ) : fontPermissionDenied ? (
                <div className="retune-font-system-prompt">
                  <p className="retune-font-denied">Font access denied. Allow in site settings to try again.</p>
                </div>
              ) : null
            )}
          </div>
        </FloatingDialog>,
        portalTarget,
      )}
    </div>
  );
}
