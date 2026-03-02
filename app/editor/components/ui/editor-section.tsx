import * as React from "react";
import { Plus, Minus } from "@/components/icons/editor";
import { cn } from "@/lib/utils";

// Basic Section - Non-collapsible section with title and icon
export interface EditorSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
}

const EditorSection = React.forwardRef<HTMLDivElement, EditorSectionProps>(
  ({ title, icon, children, className, defaultOpen = true, actions, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("border-b border-stone-100", className)} {...props}>
        <div className="w-full h-[40px] flex items-center justify-between px-[16px] py-[8px]">
          <div className="flex items-center gap-[8px]">
            {icon}
            <span className="text-[11px] font-semibold text-stone-900">{title}</span>
          </div>
          {actions && <div>{actions}</div>}
        </div>
        <div className="px-[16px] pb-[12px]">{children}</div>
      </div>
    );
  }
);
EditorSection.displayName = "EditorSection";

// Addable Section - Non-collapsible section that can be added/removed
export interface EditorAddableSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  isActive: boolean;
  onAdd: () => void;
  onRemove: () => void;
  defaultOpen?: boolean;
}

const EditorAddableSection = React.forwardRef<HTMLDivElement, EditorAddableSectionProps>(
  ({ title, icon, children, isActive, onAdd, onRemove, defaultOpen = true }, ref) => {
    if (!isActive) {
      return (
        <div ref={ref} className="border-b border-stone-100">
          <button
            type="button"
            onClick={onAdd}
            className="w-full h-[40px] flex items-center justify-between px-[16px] py-[8px] hover:bg-muted/30 transition-colors group"
          >
            <div className="flex items-center gap-[8px]">
              {icon}
              <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-stone-900">
                {title}
              </span>
            </div>
            <Plus className="w-6 h-6 text-[#6a7282] group-hover:text-stone-900" />
          </button>
        </div>
      );
    }

    return (
      <div ref={ref} className="border-b border-stone-100">
        <div className="h-[40px] flex items-center justify-between px-[16px] py-[8px]">
          <div className="flex items-center gap-[8px] flex-1">
            {icon}
            <span className="text-[11px] font-semibold text-stone-900">{title}</span>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="p-[2px] hover:bg-muted rounded-input text-[#6a7282] hover:text-stone-900 transition-colors"
            title={`Remove ${title}`}
          >
            <Minus className="w-6 h-6" />
          </button>
        </div>
        <div className="px-[16px] pb-[12px]">{children}</div>
      </div>
    );
  }
);
EditorAddableSection.displayName = "EditorAddableSection";

export { EditorSection, EditorAddableSection };
