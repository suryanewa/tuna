/**
 * FloatingDialog — shared base for floating panels (color picker, token dialog, etc.)
 *
 * Provides: anchor-based positioning with collision detection, header (title or tabs + close),
 * optional search input, scrollable body slot, close-on-escape, close-on-outside-click, scroll lock.
 *
 * Follows the FloatingPanel/SectionHeader pattern from the portfolio project, adapted for Shadow DOM.
 * Uses native DOM event listeners for close because React's event delegation doesn't work
 * inside Shadow DOM portals.
 *
 * Titlebar supports tabs — when a single tab is provided, it renders as plain text with no
 * selected/highlight style (matching the portfolio's SectionHeader behavior).
 */

import { useEffect, useRef, type ReactNode } from "react";
import { useScrollLock } from "./use-scroll-lock";

interface FloatingDialogBase {
  onClose: () => void;
  anchorRect: { top: number; left: number; width: number; height: number };
  search?: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  };
  children: ReactNode;
  /** Extra buttons rendered to the left of the close button */
  headerActions?: ReactNode;
  /** Native click handler for buttons with data-dialog-action attribute */
  onHeaderAction?: (action: string) => void;
  /** Max height for collision detection (default 400) */
  maxHeight?: number;
  /** Min height on the outer container */
  minHeight?: number;
  /** Extra class on the outer container */
  className?: string;
}

interface FloatingDialogWithTitle extends FloatingDialogBase {
  title: string;
  tabs?: never;
  activeTab?: never;
  onTabChange?: never;
}

interface FloatingDialogWithTabs extends FloatingDialogBase {
  title?: never;
  tabs: { value: string; label: string }[];
  activeTab: string;
  onTabChange?: (value: string) => void;
}

export type FloatingDialogProps = FloatingDialogWithTitle | FloatingDialogWithTabs;

export function FloatingDialog({
  title, tabs, activeTab, onTabChange,
  onClose, anchorRect, search, children,
  headerActions, onHeaderAction,
  maxHeight: maxHeightProp = 400, minHeight = 400, className,
}: FloatingDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useScrollLock(true);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onHeaderActionRef = useRef(onHeaderAction);
  onHeaderActionRef.current = onHeaderAction;

  // Auto-focus search on mount
  useEffect(() => {
    if (!search) return;
    const timer = setTimeout(() => searchRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [!!search]);

  // Close on outside click or Escape (Shadow DOM compatible)
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      if (!e.composedPath().includes(panel)) {
        onCloseRef.current();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    const root = panelRef.current?.getRootNode() as ShadowRoot | Document;
    const timer = setTimeout(() => {
      root.addEventListener("pointerdown", handlePointerDown as EventListener);
    }, 0);
    root.addEventListener("keydown", handleKeyDown as EventListener, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      clearTimeout(timer);
      root.removeEventListener("pointerdown", handlePointerDown as EventListener);
      root.removeEventListener("keydown", handleKeyDown as EventListener, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  // Native button handlers (React delegation doesn't work in Shadow DOM)
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const handleClick = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-dialog-close]")) {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      const actionEl = target.closest<HTMLElement>("[data-dialog-action]");
      if (actionEl) {
        e.preventDefault();
        e.stopPropagation();
        const action = actionEl.dataset.dialogAction;
        if (action) onHeaderActionRef.current?.(action);
      }
    };
    panel.addEventListener("pointerdown", handleClick);
    return () => panel.removeEventListener("pointerdown", handleClick);
  }, []);

  // Position — center within property panel, collision detection
  const host = document.querySelector("[data-retune-host]");
  const parentPanel = host?.shadowRoot?.querySelector(".retune-panel");
  const parentRect = parentPanel?.getBoundingClientRect();
  const panelWidth = parentRect ? parentRect.width - 24 : 240;
  const left = parentRect
    ? parentRect.left + (parentRect.width - panelWidth) / 2
    : Math.max(4, Math.min(anchorRect.left + anchorRect.width - panelWidth, window.innerWidth - panelWidth - 4));

  const gap = 4;
  const spaceBelow = window.innerHeight - anchorRect.top - anchorRect.height - gap;
  const spaceAbove = anchorRect.top - gap;
  const flipUp = spaceBelow < maxHeightProp && spaceAbove > spaceBelow;
  const maxHeight = Math.min(maxHeightProp, flipUp ? spaceAbove : spaceBelow);
  const clampedMinHeight = Math.min(minHeight, maxHeight);

  const posStyle: React.CSSProperties = flipUp
    ? { position: "fixed", bottom: window.innerHeight - anchorRect.top + gap, left, width: panelWidth, maxHeight, minHeight: clampedMinHeight }
    : { position: "fixed", top: anchorRect.top + anchorRect.height + gap, left, width: panelWidth, maxHeight, minHeight: clampedMinHeight };

  // Header: title or tabs
  const isTabs = !!tabs;
  const isSingleTab = isTabs && tabs.length === 1;

  return (
    <div
      ref={panelRef}
      className={`retune-floating-dialog${className ? ` ${className}` : ""}`}
      style={posStyle}
    >
      <div className="retune-floating-dialog-header">
        <div className="retune-floating-dialog-title-area">
          {isTabs ? (
            tabs.map(tab => {
              const isActive = tab.value === activeTab;
              return (
                <button
                  key={tab.value}
                  type="button"
                  className={
                    isSingleTab
                      ? "retune-floating-dialog-tab retune-floating-dialog-tab-single"
                      : `retune-floating-dialog-tab${isActive ? " retune-floating-dialog-tab-active" : ""}`
                  }
                  onClick={onTabChange ? () => onTabChange(tab.value) : undefined}
                >
                  {tab.label}
                </button>
              );
            })
          ) : (
            <span className="retune-floating-dialog-title">{title}</span>
          )}
        </div>
        {headerActions}
        <button type="button" className="retune-floating-dialog-close" data-dialog-close>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M16.6464 6.64645C16.8417 6.45118 17.1582 6.45118 17.3535 6.64645C17.5487 6.84171 17.5487 7.15822 17.3535 7.35348L12.707 12L17.3535 16.6464C17.5487 16.8417 17.5487 17.1582 17.3535 17.3535C17.1582 17.5487 16.8417 17.5487 16.6464 17.3535L12 12.707L7.35348 17.3535C7.15822 17.5487 6.84171 17.5487 6.64645 17.3535C6.45118 17.1582 6.45118 16.8417 6.64645 16.6464L11.2929 12L6.64645 7.35348C6.45123 7.15821 6.4512 6.84169 6.64645 6.64645C6.8417 6.45125 7.15823 6.45125 7.35348 6.64645L12 11.2929L16.6464 6.64645Z" fill="rgba(0,0,0,0.9)" />
          </svg>
        </button>
      </div>
      {search && (
        <div className="retune-floating-dialog-search">
          <input
            ref={searchRef}
            className="retune-floating-dialog-search-input"
            placeholder={search.placeholder || "Search"}
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            onKeyDown={search.onKeyDown}
            spellCheck={false}
          />
        </div>
      )}
      <div className="retune-floating-dialog-body">
        {children}
      </div>
    </div>
  );
}
