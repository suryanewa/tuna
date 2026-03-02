"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { IconButton, type IconButtonProps } from "./icon-button";

export type SectionHeaderIconButton = {
  icon: IconButtonProps["icon"];
  onClick?: () => void;
  disabled?: boolean;
  "aria-label"?: string;
  menuItems?: IconButtonProps["menuItems"];
  onMenuSelect?: IconButtonProps["onMenuSelect"];
  menuValue?: IconButtonProps["menuValue"];
};

interface SectionHeaderBase {
  iconButton?: SectionHeaderIconButton;
  /** Optional secondary button rendered to the left of iconButton (e.g. add effect [+] before close [X]) */
  secondaryIconButton?: SectionHeaderIconButton;
  /** When true, header renders at 50% opacity (100% on hover) and clicking
   *  anywhere on the header triggers the iconButton action. */
  isEmpty?: boolean;
  className?: string;
}

interface DefaultSectionHeaderProps extends SectionHeaderBase {
  title: string;
  tabs?: never;
  activeTab?: never;
  onTabChange?: never;
}

interface TabbedSectionHeaderProps extends SectionHeaderBase {
  title?: never;
  tabs: { value: string; label: string }[];
  activeTab: string;
  onTabChange?: (value: string) => void;
}

export type SectionHeaderProps = DefaultSectionHeaderProps | TabbedSectionHeaderProps;

export function SectionHeader({
  title,
  tabs,
  activeTab,
  onTabChange,
  iconButton,
  secondaryIconButton,
  isEmpty,
  className,
}: SectionHeaderProps) {
  const isTabs = !!tabs;
  const isSingleTab = isTabs && tabs.length === 1;
  const iconButtonRef = React.useRef<HTMLButtonElement>(null);

  const handleHeaderClick = (e: React.MouseEvent) => {
    if (!isEmpty || !iconButton) return;
    // Don't double-fire if user clicked the icon button itself
    if (iconButtonRef.current?.contains(e.target as Node)) return;

    if (iconButton.onClick) {
      iconButton.onClick();
    } else {
      // For menu-based buttons, programmatically click to open the menu
      iconButtonRef.current?.click();
    }
  };

  return (
    <div
      onClick={handleHeaderClick}
      className={cn(
        "flex items-center justify-between",
        isTabs ? "p-2" : iconButton ? "pl-4 pr-2 py-1" : "px-4 h-8",
        isEmpty && "opacity-50 hover:opacity-100 transition-opacity cursor-pointer",
        className
      )}
    >
      {isTabs ? (
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = tab.value === activeTab;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={onTabChange ? () => onTabChange(tab.value) : undefined}
                className={cn(
                  "h-6 px-2 rounded-[5px] text-[11px] leading-4 tracking-[0.055px]",
                  "whitespace-nowrap overflow-hidden text-ellipsis",
                  "transition-colors duration-150 focus:outline-none",
                  isSingleTab
                    ? "font-[550] text-stone-900 dark:text-stone-100 !cursor-[inherit]"
                    : isActive
                      ? "bg-stone-100 dark:bg-stone-800 font-[550] text-stone-900 dark:text-stone-100"
                      : "font-[450] text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-700",
                  !isSingleTab && !onTabChange && "cursor-default"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      ) : (
        <span className="text-[11px] leading-4 tracking-[0.055px] font-[550] text-stone-900 dark:text-stone-100 min-w-0 flex-1">
          {title}
        </span>
      )}
      {(iconButton || secondaryIconButton) && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {secondaryIconButton && (
            <IconButton
              icon={secondaryIconButton.icon}
              onClick={secondaryIconButton.onClick}
              disabled={secondaryIconButton.disabled}
              aria-label={secondaryIconButton["aria-label"]}
              menuItems={secondaryIconButton.menuItems}
              onMenuSelect={secondaryIconButton.onMenuSelect}
              menuValue={secondaryIconButton.menuValue}
            />
          )}
          {iconButton && (
            <IconButton
              ref={iconButtonRef}
              icon={iconButton.icon}
              onClick={iconButton.onClick}
              disabled={iconButton.disabled}
              aria-label={iconButton["aria-label"]}
              menuItems={iconButton.menuItems}
              onMenuSelect={iconButton.onMenuSelect}
              menuValue={iconButton.menuValue}
            />
          )}
        </div>
      )}
    </div>
  );
}

SectionHeader.displayName = "SectionHeader";
