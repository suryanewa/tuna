import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { ChevronDown } from "@/components/icons/editor";

const editorSelectVariants = cva(
  "w-full bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-[450] text-[11px] tracking-[-0.055px] focus-visible:outline-none hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors duration-150 cursor-pointer border-0 h-6 appearance-none pr-6",
  {
    variants: {
      size: {
        sm: "px-1.5",
        md: "px-1.5",
      },
    },
    defaultVariants: {
      size: "sm",
    },
  }
);

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface EditorSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size" | "onChange">,
    VariantProps<typeof editorSelectVariants> {
  /** Controlled value */
  value?: string;
  /** Options array - if provided, renders options automatically */
  options?: SelectOption[];
  /** Callback when value changes */
  onValueChange?: (value: string) => void;
  /** Legacy onChange for direct select usage */
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  /** Optional lead icon */
  leadIcon?: React.ComponentType<{ className?: string }>;
}

const EditorSelect = React.forwardRef<HTMLSelectElement, EditorSelectProps>(
  ({ className, size, children, options, value, onValueChange, onChange, leadIcon: LeadIcon, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (onValueChange) {
        onValueChange(e.target.value);
      }
      if (onChange) {
        onChange(e);
      }
    };

    return (
      <div className={cn("relative flex items-center w-full rounded-input overflow-hidden focus-within:outline focus-within:outline-1 focus-within:-outline-offset-1 focus-within:outline-ring", className)}>
        {LeadIcon && (
          <LeadIcon className="absolute left-0 w-6 h-6 text-stone-500 dark:text-stone-400 pointer-events-none" />
        )}
        <select
          className={cn(
            editorSelectVariants({ size }),
            LeadIcon ? "pl-6" : "pl-1.5"
          )}
          ref={ref}
          value={value}
          onChange={handleChange}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <ChevronDown className="absolute right-0 w-6 h-6 text-stone-500 dark:text-stone-400 pointer-events-none" />
      </div>
    );
  }
);
EditorSelect.displayName = "EditorSelect";

export { EditorSelect, editorSelectVariants };
