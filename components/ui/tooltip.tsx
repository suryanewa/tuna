"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & {
    shortcut?: string;
  }
>(({ className, sideOffset = 6, shortcut, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-w-[200px] rounded-[5px] bg-[#1e1e1e] px-2 py-1 shadow-[0px_0px_0.5px_0px_rgba(0,0,0,0.15),0px_5px_12px_0px_rgba(0,0,0,0.13),0px_1px_3px_0px_rgba(0,0,0,0.1)]",
        "flex items-center gap-1",
        "text-[11px] font-medium leading-4 tracking-[0.055px]",
        "animate-in fade-in-0 zoom-in-95",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        "origin-[--radix-tooltip-content-transform-origin]",
        className
      )}
      style={{ fontFamily: "'Inter', sans-serif", ...props.style }}
      {...props}
    >
      <span className="min-w-0 flex-1 text-white">{children}</span>
      {shortcut && (
        <span className="shrink-0 text-white/70">{shortcut}</span>
      )}
      <TooltipPrimitive.Arrow
        style={{ fill: "#1e1e1e" }}
        width={12}
        height={6}
      />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
