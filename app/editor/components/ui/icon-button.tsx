"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, type DropdownMenuOption } from "./dropdown-menu";

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ComponentType<{ className?: string }>;
  /** Button size: "default" uses 24px icons, "sm" uses 16px icons with subtle hover */
  size?: "default" | "sm";
  /** When provided, clicking opens a menu instead of triggering onClick */
  menuItems?: DropdownMenuOption[];
  /** Called when a menu item is selected */
  onMenuSelect?: (item: DropdownMenuOption) => void;
  /** Currently selected menu value (shows checkmark) */
  menuValue?: string;
  /** Toggle mode: whether the button is currently pressed/active */
  toggled?: boolean;
  /** Called when the toggle state changes */
  onToggle?: (toggled: boolean) => void;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, size = "default", className, disabled, menuItems, onMenuSelect, menuValue, toggled, onToggle, onClick, ...props }, ref) => {
    const [menuOpen, setMenuOpen] = React.useState(false);
    const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
    const [hovered, setHovered] = React.useState(false);

    const hasMenu = menuItems && menuItems.length > 0;
    const isToggle = toggled !== undefined;
    const isSmall = size === "sm";
    const smActive = isSmall && (hovered || (isToggle && toggled));

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (hasMenu) {
        // Toggle handled by PopoverTrigger
        return;
      } else if (isToggle) {
        onToggle?.(!toggled);
      } else {
        onClick?.(e);
      }
    };

    const handleMenuSelect = (option: DropdownMenuOption) => {
      onMenuSelect?.(option);
      setMenuOpen(false);
      setHighlightedIndex(-1);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (!hasMenu || !menuOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        setMenuOpen(false);
        setHighlightedIndex(-1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < menuItems!.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === "Enter" && highlightedIndex >= 0) {
        e.preventDefault();
        handleMenuSelect(menuItems![highlightedIndex]);
      }
    };

    const button = (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={isSmall ? () => setHovered(true) : undefined}
        onMouseLeave={isSmall ? () => setHovered(false) : undefined}
        className={cn(
          "w-6 h-6 flex items-center justify-center rounded-input",
          "",
          "focus:outline-none",
          "disabled:text-stone-500 disabled:dark:text-stone-400 disabled:opacity-50 disabled:cursor-not-allowed",
          !isSmall && "hover:bg-stone-100 dark:hover:bg-stone-800",
          !isSmall && isToggle && toggled && "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
          className
        )}
        style={smActive ? { backgroundColor: "rgba(3, 7, 18, 0.03)" } : undefined}
        aria-pressed={isToggle ? toggled : undefined}
        aria-haspopup={hasMenu ? "listbox" : undefined}
        aria-expanded={hasMenu ? menuOpen : undefined}
        {...props}
      >
        <Icon />
      </button>
    );

    if (!hasMenu) return button;

    return (
      <Popover open={menuOpen} onOpenChange={(open) => { setMenuOpen(open); setHighlightedIndex(-1); }}>
        <PopoverTrigger asChild>{button}</PopoverTrigger>
        <PopoverContent
          className="p-0 border-0 bg-transparent shadow-none"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          style={{
            width: "auto",
            minWidth: 120,
          }}
        >
          <DropdownMenu
            options={menuItems!}
            value={menuValue}
            highlightedIndex={highlightedIndex}
            onSelect={handleMenuSelect}
            onHighlight={setHighlightedIndex}
            showCheckmark={menuValue !== undefined}
          />
        </PopoverContent>
      </Popover>
    );
  }
);

IconButton.displayName = "IconButton";
