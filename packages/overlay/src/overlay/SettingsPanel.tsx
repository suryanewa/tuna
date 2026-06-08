/**
 * SettingsPanel — accessible from the toolbar settings icon.
 * Main view: theme, output detail, hide toggle, keyboard shortcuts link.
 * Sub-view: keyboard shortcuts reference.
 */

import { useState, useCallback, useRef } from "react";
import { SelectInput } from "../ui/select-input";

interface SettingsPanelProps {
  side: "left" | "right";
  theme: "system" | "light" | "dark";
  onThemeChange: (theme: "system" | "light" | "dark") => void;
  fidelity: "minimal" | "standard" | "full";
  onFidelityChange: (fidelity: "minimal" | "standard" | "full") => void;
  onHide: () => void;
  version?: string;
  updateAvailable?: boolean;
  exiting?: boolean;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
const MOD = isMac ? "⌘" : "Ctrl";
const ALT = isMac ? "⌥" : "Alt";
const DEL = isMac ? "⌫" : "Del";

const SHORTCUTS: Array<{ label: string; keys: string[] }> = [
  { label: "Toggle Retune", keys: [ALT, "D"] },
  { label: "Undo", keys: [MOD, "Z"] },
  { label: "Redo", keys: [MOD, "⇧", "Z"] },
  { label: "Select Child", keys: ["Enter"] },
  { label: "Select Parent", keys: ["⇧", "Enter"] },
  { label: "Select Next Sibling", keys: ["Tab"] },
  { label: "Select Previous Sibling", keys: ["⇧", "Tab"] },
  { label: "Deselect", keys: ["Esc"] },
  { label: "Deselect all", keys: ["⇧", "Esc"] },
  { label: "Reorder", keys: ["↑", "↓", "←", "→"] },
  { label: "Delete Element", keys: [DEL] },
  { label: "Measure Spacing", keys: [ALT, "Hover"] },
];

function KeyBadge({ children }: { children: string }) {
  const isWide = children.length > 1;
  return <span className={`retune-key${isWide ? " wide" : ""}`}>{children}</span>;
}

const ChevronRight = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M10 8L14 12L10 16" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronLeft = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M14 8L10 12L14 16" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EASE_IN_OUT = "130ms cubic-bezier(0.645, 0.045, 0.355, 1)";
const EASE_OUT = "130ms cubic-bezier(0.215, 0.61, 0.355, 1)";

export function SettingsPanel({
  side,
  theme,
  onThemeChange,
  fidelity,
  onFidelityChange,
  onHide,
  version,
  updateAvailable,
  exiting,
}: SettingsPanelProps) {
  const [view, setView] = useState<"main" | "shortcuts">("main");
  const panelRef = useRef<HTMLDivElement>(null);

  const animateHeight = useCallback((nextView: "main" | "shortcuts") => {
    const panel = panelRef.current;
    if (!panel) { setView(nextView); return; }

    const fromHeight = panel.offsetHeight;
    panel.style.height = `${fromHeight}px`;
    panel.style.transition = "none";

    setView(nextView);

    requestAnimationFrame(() => {
      panel.style.height = "auto";
      const toHeight = panel.offsetHeight;
      panel.style.height = `${fromHeight}px`;

      requestAnimationFrame(() => {
        panel.style.transition = `height ${EASE_IN_OUT}`;
        panel.style.height = `${toHeight}px`;

        const cleanup = () => {
          panel.removeEventListener("transitionend", cleanup);
          panel.style.transition = "";
          panel.style.height = "";
        };
        panel.addEventListener("transitionend", cleanup, { once: true });
      });
    });
  }, []);

  const handleThemeChange = useCallback((_prop: string, value: string) => {
    onThemeChange(value as "system" | "light" | "dark");
  }, [onThemeChange]);

  const handleFidelityChange = useCallback((_prop: string, value: string) => {
    onFidelityChange(value as "minimal" | "standard" | "full");
  }, [onFidelityChange]);

  const isMain = view === "main";

  return (
    <div ref={panelRef} className={`retune-settings-panel ${side}${exiting ? " exiting" : ""}`}>
      <div className="retune-settings-clip">
      {/* ── Main settings view ── */}
      <div
        className="retune-settings-view-container"
        style={{
          opacity: isMain ? 1 : 0,
          transition: `opacity ${isMain ? EASE_OUT : EASE_IN_OUT}${isMain ? " 30ms" : ""}`,
          pointerEvents: isMain ? "auto" : "none",
          position: isMain ? "relative" : "absolute",
          top: 0, left: 0, right: 0,
        }}
      >
        <div className="retune-settings-header">
          <span className="retune-settings-title">Settings</span>
          {version && (
            <span className="retune-settings-version">
              {updateAvailable && <span className="retune-settings-version-dot" aria-hidden />}
              v{version}
            </span>
          )}
        </div>
        <div className="retune-settings-body">
          <div className="retune-settings-row">
            <span className="retune-settings-label">Theme</span>
            <div style={{ width: 96 }}>
              <SelectInput
                prop="theme"
                value={theme}
                options={["system", "light", "dark"]}
                onChange={handleThemeChange}
              />
            </div>
          </div>
          <div className="retune-settings-row">
            <span className="retune-settings-label">Output Detail</span>
            <div style={{ width: 96 }}>
              <SelectInput
                prop="fidelity"
                value={fidelity}
                options={["minimal", "standard", "full"]}
                onChange={handleFidelityChange}
              />
            </div>
          </div>
          <div className="retune-settings-row">
            <span className="retune-settings-label">Hide Retune for this session</span>
            <div className="retune-switch-wrap">
              <button className="retune-switch" onClick={onHide}>
                <span className="retune-switch-knob" />
              </button>
            </div>
          </div>
          <div
            className="retune-settings-row clickable"
            onClick={() => animateHeight("shortcuts")}
          >
            <span className="retune-settings-label">Keyboard shortcuts</span>
            <ChevronRight />
          </div>
        </div>
      </div>

      {/* ── Keyboard shortcuts view ── */}
      <div
        className="retune-settings-view-container"
        style={{
          opacity: !isMain ? 1 : 0,
          transition: `opacity ${!isMain ? EASE_OUT : EASE_IN_OUT}${!isMain ? " 30ms" : ""}`,
          pointerEvents: !isMain ? "auto" : "none",
          position: !isMain ? "relative" : "absolute",
          top: 0, left: 0, right: 0,
        }}
      >
        <div className="retune-settings-header retune-settings-back" onClick={() => animateHeight("main")}>
          <ChevronLeft />
          <span className="retune-settings-title" style={{ padding: "8px 0" }}>Keyboard shortcuts</span>
        </div>
        <div className="retune-settings-body">
          {SHORTCUTS.map((s) => (
            <div className="retune-settings-row" key={s.label}>
              <span className="retune-settings-label">{s.label}</span>
              <div className="retune-key-group">
                {s.keys.map((k, i) => (
                  <KeyBadge key={i}>{k}</KeyBadge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
