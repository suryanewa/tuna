"use client";

import * as React from "react";
import { SectionWrapper } from "./section-wrapper";
import { SectionHeader } from "../ui/section-header";
import { Dropdown, type DropdownOption } from "../ui/dropdown";
import { NumberInput } from "../ui/number-input";
import { IconButton } from "../ui/icon-button";
import { type DropdownMenuOption } from "../ui/dropdown-menu";
import {
  PlusSmall,
  MinusSmall,
  EyeSmall,
  HiddenSmall,
  LayerBlurSmallSmall,
  ContrastFilterSmall,
  SunSmall,
  SaturationFilterSmall,
  ImageSmall,
  HueRotateSmall,
  InvertSmall,
} from "@/components/icons/editor";

// ============================================================================
// Types
// ============================================================================

export type FilterType =
  | "blur"
  | "brightness"
  | "contrast"
  | "hueRotate"
  | "invert"
  | "saturate"
  | "sepia";

export type FilterTarget = "layer" | "backdrop";

export interface FilterItem {
  id: string;
  type: FilterType;
  value: string;
  target: FilterTarget;
  visible?: boolean;
}

export interface FilterSectionProps {
  filters: FilterItem[];
  onFiltersChange: (filters: FilterItem[]) => void;
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

interface FilterTypeConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultValue: string;
  min: number;
  max: number;
  step: number;
}

const FILTER_TYPE_CONFIG: Record<FilterType, FilterTypeConfig> = {
  blur: {
    label: "Blur",
    icon: LayerBlurSmallSmall,
    defaultValue: "4",
    min: 0,
    max: 50,
    step: 1,
  },
  brightness: {
    label: "Brightness",
    icon: SunSmall,
    defaultValue: "100",
    min: 0,
    max: 300,
    step: 1,
  },
  contrast: {
    label: "Contrast",
    icon: ContrastFilterSmall,
    defaultValue: "100",
    min: 0,
    max: 200,
    step: 1,
  },
  hueRotate: {
    label: "Hue Rotate",
    icon: HueRotateSmall,
    defaultValue: "0",
    min: 0,
    max: 360,
    step: 1,
  },
  invert: {
    label: "Invert",
    icon: InvertSmall,
    defaultValue: "0",
    min: 0,
    max: 100,
    step: 1,
  },
  saturate: {
    label: "Saturate",
    icon: SaturationFilterSmall,
    defaultValue: "100",
    min: 0,
    max: 300,
    step: 1,
  },
  sepia: {
    label: "Sepia",
    icon: ImageSmall,
    defaultValue: "0",
    min: 0,
    max: 100,
    step: 1,
  },
};

const ALL_FILTER_TYPES: FilterType[] = [
  "blur",
  "brightness",
  "contrast",
  "hueRotate",
  "invert",
  "saturate",
  "sepia",
];

const labelClassName =
  "text-[9px] font-medium leading-4 tracking-[0.045px] text-stone-500 dark:text-stone-400";

// ============================================================================
// Component
// ============================================================================

export function FilterSection({
  filters,
  onFiltersChange,
  disabled = false,
  className,
}: FilterSectionProps) {
  const usedTargets = new Map<FilterType, Set<FilterTarget>>();
  filters.forEach((f) => {
    if (!usedTargets.has(f.type)) usedTargets.set(f.type, new Set());
    usedTargets.get(f.type)!.add(f.target);
  });

  const isFullyUsed = (type: FilterType) => {
    const targets = usedTargets.get(type);
    return targets ? targets.has("layer") && targets.has("backdrop") : false;
  };

  const allAdded = ALL_FILTER_TYPES.every(isFullyUsed);

  // Build "Add filter" menu items grouped by target
  const layerMenuItems: DropdownMenuOption[] = [];
  const backdropMenuItems: DropdownMenuOption[] = [];
  for (const type of ALL_FILTER_TYPES) {
    const config = FILTER_TYPE_CONFIG[type];
    const usedSet = usedTargets.get(type);
    if (!usedSet?.has("layer")) {
      layerMenuItems.push({ value: `${type}:layer`, label: config.label });
    }
    if (!usedSet?.has("backdrop")) {
      backdropMenuItems.push({ value: `${type}:backdrop`, label: config.label });
    }
  }
  const menuItems: DropdownMenuOption[] = [];
  if (layerMenuItems.length > 0) {
    layerMenuItems[0].headingBefore = "Layer";
    menuItems.push(...layerMenuItems);
  }
  if (backdropMenuItems.length > 0) {
    backdropMenuItems[0].headingBefore = "Backdrop";
    backdropMenuItems[0].separatorBefore = layerMenuItems.length > 0;
    menuItems.push(...backdropMenuItems);
  }

  const handleMenuSelect = (item: DropdownMenuOption) => {
    const [typeStr, targetStr] = item.value.split(":");
    const filterType = typeStr as FilterType;
    const target = targetStr as FilterTarget;
    const config = FILTER_TYPE_CONFIG[filterType];
    const newFilter: FilterItem = {
      id: crypto.randomUUID(),
      type: filterType,
      value: config.defaultValue,
      target,
      visible: true,
    };
    onFiltersChange([...filters, newFilter]);
  };

  const handleValueChange = (index: number, value: string | undefined) => {
    const updated = filters.map((f, i) =>
      i === index ? { ...f, value: value ?? "" } : f
    );
    onFiltersChange(updated);
  };

  const handleTypeChange = (index: number, newType: FilterType) => {
    const config = FILTER_TYPE_CONFIG[newType];
    const updated = filters.map((f, i) =>
      i === index ? { ...f, type: newType, value: config.defaultValue } : f
    );
    onFiltersChange(updated);
  };

  const handleVisibilityToggle = (index: number) => {
    const updated = filters.map((f, i) =>
      i === index ? { ...f, visible: f.visible === false ? true : false } : f
    );
    onFiltersChange(updated);
  };

  const handleRemove = (index: number) => {
    onFiltersChange(filters.filter((_, i) => i !== index));
  };

  // Build dropdown options for a given filter row (disable types already used for that target)
  const getTypeOptions = (target: FilterTarget, currentType: FilterType): DropdownOption[] => {
    return ALL_FILTER_TYPES.map((type) => {
      const config = FILTER_TYPE_CONFIG[type];
      const usedSet = usedTargets.get(type);
      const isUsedByOther = usedSet?.has(target) && type !== currentType;
      return {
        value: type,
        label: config.label,
        disabled: isUsedByOther,
      };
    });
  };

  // Group filters by target for display
  const layerFilters = filters
    .map((f, i) => ({ filter: f, originalIndex: i }))
    .filter(({ filter }) => filter.target === "layer");
  const backdropFilters = filters
    .map((f, i) => ({ filter: f, originalIndex: i }))
    .filter(({ filter }) => filter.target === "backdrop");

  return (
    <SectionWrapper className={className}>
      <SectionHeader
        title="Filters"
        isEmpty={filters.length === 0}
        iconButton={
          !allAdded
            ? {
                icon: PlusSmall,
                menuItems,
                onMenuSelect: handleMenuSelect,
                "aria-label": "Add filter",
              }
            : undefined
        }
      />
      {filters.length > 0 && (
        <div className="flex flex-col gap-2 pb-3">
          {layerFilters.length > 0 && (
            <div className="flex flex-col">
              <div className="px-4">
                <span className={labelClassName}>Layer</span>
              </div>
              {layerFilters.map(({ filter, originalIndex }) => (
                <FilterRow
                  key={filter.id}
                  filter={filter}
                  typeOptions={getTypeOptions(filter.target, filter.type)}
                  onTypeChange={(newType) => handleTypeChange(originalIndex, newType)}
                  onValueChange={(v) => handleValueChange(originalIndex, v)}
                  onToggleVisibility={() => handleVisibilityToggle(originalIndex)}
                  onRemove={() => handleRemove(originalIndex)}
                  disabled={disabled}
                />
              ))}
            </div>
          )}
          {backdropFilters.length > 0 && (
            <div className="flex flex-col">
              <div className="px-4">
                <span className={labelClassName}>Backdrop</span>
              </div>
              {backdropFilters.map(({ filter, originalIndex }) => (
                <FilterRow
                  key={filter.id}
                  filter={filter}
                  typeOptions={getTypeOptions(filter.target, filter.type)}
                  onTypeChange={(newType) => handleTypeChange(originalIndex, newType)}
                  onValueChange={(v) => handleValueChange(originalIndex, v)}
                  onToggleVisibility={() => handleVisibilityToggle(originalIndex)}
                  onRemove={() => handleRemove(originalIndex)}
                  disabled={disabled}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </SectionWrapper>
  );
}

FilterSection.displayName = "FilterSection";

// ============================================================================
// Filter Row
// ============================================================================

interface FilterRowProps {
  filter: FilterItem;
  typeOptions: DropdownOption[];
  onTypeChange: (newType: FilterType) => void;
  onValueChange: (value: string | undefined) => void;
  onToggleVisibility: () => void;
  onRemove: () => void;
  disabled?: boolean;
}

function FilterRow({
  filter,
  typeOptions,
  onTypeChange,
  onValueChange,
  onToggleVisibility,
  onRemove,
  disabled = false,
}: FilterRowProps) {
  const config = FILTER_TYPE_CONFIG[filter.type];

  return (
    <div className="flex items-center gap-2 pl-4 pr-2 py-1">
      <Dropdown
        value={filter.type}
        onValueChange={(v) => onTypeChange(v as FilterType)}
        options={typeOptions}
        leadIcon={config.icon}
        disabled={disabled}
        className="flex-1 min-w-0"
      />
      <NumberInput
        value={filter.value}
        onChange={onValueChange}
        min={config.min}
        max={config.max}
        step={config.step}
        disabled={disabled}
        className="w-14 min-w-0 shrink-0"
      />
      <div className="flex items-center gap-1 shrink-0">
        <IconButton
          icon={filter.visible === false ? HiddenSmall : EyeSmall}
          toggled={filter.visible === false}
          onToggle={onToggleVisibility}
          disabled={disabled}
          aria-label={`Toggle ${config.label} visibility`}
        />
        <IconButton
          icon={MinusSmall}
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${config.label} filter`}
        />
      </div>
    </div>
  );
}
