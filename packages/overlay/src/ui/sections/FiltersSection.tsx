/**
 * FiltersSection -- filter list (blur, brightness, contrast, etc.)
 * with add/remove, backdrop vs layer grouping.
 *
 * Extracted from PropertyPanel.tsx lines 2188-2310.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import type { BaseSectionProps } from "./section-props";
import {
  parseFilters, filtersToCss, defaultFilter,
  FILTER_TYPES, FILTER_CONFIG,
  type FilterItem, type FilterType, type FilterTarget,
} from "../filter-utils";
import { Section, Row } from "../section";
import { SliderInput } from "../slider-input";
import { DropdownMenu, type DropdownMenuOption } from "../dropdown-menu";
import { Tooltip } from "../tooltip";
import { Plus, Minus } from "../icons";

export interface FiltersSectionProps extends BaseSectionProps {}

export function FiltersSection({
  s,
  onPropertyChange,
}: FiltersSectionProps) {
  // ── Filter state ──
  // Use a ref to skip re-sync when we are the source of the change
  const filterSelfUpdate = useRef(false);
  const [filters, setFilters] = useState<FilterItem[]>(() => parseFilters(s.filter, s.backdropFilter));

  // Sync from parent when external styles change
  useEffect(() => {
    if (filterSelfUpdate.current) {
      filterSelfUpdate.current = false;
      return;
    }
    setFilters(parseFilters(s.filter, s.backdropFilter));
  }, [s.filter, s.backdropFilter]);

  // ── Menu state ──
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [filterMenuPos, setFilterMenuPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const filterMenuBtnRef = useRef<HTMLButtonElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const filterSectionRef = useRef<HTMLDivElement>(null);

  // Close filter menu on outside click
  useEffect(() => {
    if (!filterMenuOpen) return;
    const handleClick = (e: PointerEvent) => {
      const btn = filterMenuBtnRef.current;
      const menu = filterMenuRef.current;
      if (btn && btn.contains(e.target as Node)) return;
      if (menu && menu.contains(e.target as Node)) return;
      setFilterMenuOpen(false);
    };
    const root = filterMenuBtnRef.current?.getRootNode() as ShadowRoot | Document;
    root.addEventListener("pointerdown", handleClick as EventListener);
    return () => root.removeEventListener("pointerdown", handleClick as EventListener);
  }, [filterMenuOpen]);

  // ── Callbacks ──
  const applyFilters = useCallback((updated: FilterItem[]) => {
    filterSelfUpdate.current = true;
    setFilters(updated);
    const css = filtersToCss(updated);
    onPropertyChange("filter", css.filter);
    onPropertyChange("backdropFilter", css.backdropFilter);
  }, [onPropertyChange]);

  const handleAddFilter = useCallback((type: FilterType, target: FilterTarget) => {
    applyFilters([...filters, defaultFilter(type, target)]);
    setFilterMenuOpen(false);
    requestAnimationFrame(() => {
      filterSectionRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    });
  }, [filters, applyFilters]);

  const handleRemoveFilter = useCallback((id: string) => {
    applyFilters(filters.filter((f) => f.id !== id));
  }, [filters, applyFilters]);

  const handleFilterValueChange = useCallback((id: string, value: number) => {
    applyFilters(filters.map((f) => f.id === id ? { ...f, value } : f));
  }, [filters, applyFilters]);

  return (
    <>
      <Section
        label="Filters"
        action={
          <div style={{ position: "relative" }}>
            <Tooltip content="Add filter" side="top">
              <button
                ref={filterMenuBtnRef}
                className="tuna-section-action"
                onClick={() => {
                  if (filterMenuOpen) {
                    setFilterMenuOpen(false);
                    return;
                  }
                  const btn = filterMenuBtnRef.current;
                  if (!btn) return;
                  const rect = btn.getBoundingClientRect();
                  const spaceBelow = window.innerHeight - rect.bottom - 8;
                  const spaceAbove = rect.top - 8;
                  if (spaceBelow >= spaceAbove) {
                    setFilterMenuPos({ top: rect.bottom + 4, left: rect.right });
                  } else {
                    setFilterMenuPos({ bottom: window.innerHeight - rect.top + 4, left: rect.right });
                  }
                  setFilterMenuOpen(true);
                }}
              >
                <Plus />
              </button>
            </Tooltip>
            {filterMenuOpen && filterMenuPos && (
              <div
                ref={filterMenuRef}
                style={{
                  position: "fixed",
                  ...(filterMenuPos.top != null ? { top: filterMenuPos.top } : { bottom: filterMenuPos.bottom }),
                  left: filterMenuPos.left,
                  transform: "translateX(-100%)",
                  zIndex: 2147483647,
                }}
              >
                <DropdownMenu
                  options={(() => {
                    const usedLayer = new Set(filters.filter((f) => f.target === "layer").map((f) => f.type));
                    const usedBackdrop = new Set(filters.filter((f) => f.target === "backdrop").map((f) => f.type));
                    const availLayer = FILTER_TYPES.filter((t) => !usedLayer.has(t));
                    const availBackdrop = FILTER_TYPES.filter((t) => !usedBackdrop.has(t));
                    const opts: DropdownMenuOption[] = [];
                    availLayer.forEach((t, i) => {
                      opts.push({
                        value: `layer:${t}`,
                        label: FILTER_CONFIG[t].label,
                        ...(i === 0 ? { headingBefore: "Layer" } : {}),
                      });
                    });
                    availBackdrop.forEach((t, i) => {
                      opts.push({
                        value: `backdrop:${t}`,
                        label: FILTER_CONFIG[t].label,
                        ...(i === 0 ? { headingBefore: "Backdrop", ...(availLayer.length > 0 ? { separatorBefore: true } : {}) } : {}),
                      });
                    });
                    return opts;
                  })()}
                  showCheckmark={false}
                  onSelect={(option) => {
                    const [target, type] = option.value.split(":") as [FilterTarget, FilterType];
                    handleAddFilter(type, target);
                  }}
                />
              </div>
            )}
          </div>
        }
      >
        {filters.length > 0 && (() => {
          const layerFilters = filters.filter((f) => f.target === "layer");
          const backdropFilters = filters.filter((f) => f.target === "backdrop");
          const renderFilterRow = (f: FilterItem) => {
            const config = FILTER_CONFIG[f.type];
            return (
              <div className="tuna-row" key={f.id}>
                <SliderInput
                  label={config.label}
                  prop={f.id}
                  value={String(f.value)}
                  min={config.min}
                  max={config.max}
                  step={config.step}
                  onChange={(_p, val) => handleFilterValueChange(f.id, parseFloat(val) || 0)}
                />
                <div style={{ alignSelf: "center" }}>
                  <Tooltip content="Remove" side="top">
                    <button className="tuna-split-btn" onClick={() => handleRemoveFilter(f.id)}>
                      <Minus />
                    </button>
                  </Tooltip>
                </div>
              </div>
            );
          };

          return (
            <>
              {layerFilters.length > 0 && (
                <Row label="Layer">
                  {layerFilters.map(renderFilterRow)}
                </Row>
              )}
              {backdropFilters.length > 0 && (
                <Row label="Backdrop">
                  {backdropFilters.map(renderFilterRow)}
                </Row>
              )}
            </>
          );
        })()}
      </Section>
      <div ref={filterSectionRef} />
    </>
  );
}
