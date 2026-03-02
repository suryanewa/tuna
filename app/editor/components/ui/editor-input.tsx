import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const editorInputVariants = cva(
  "w-full bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      size: {
        sm: "px-2 py-1.5 text-xs rounded-input",
        md: "px-3 py-2 text-sm rounded-input",
      },
      variant: {
        default: "",
        inline: "bg-transparent border-transparent hover:border-border focus:border-border focus:bg-input",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "default",
    },
  }
);

export interface EditorInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof editorInputVariants> {}

const EditorInput = React.forwardRef<HTMLInputElement, EditorInputProps>(
  ({ className, size, variant, ...props }, ref) => {
    return (
      <input
        className={cn(editorInputVariants({ size, variant, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
EditorInput.displayName = "EditorInput";

export { EditorInput, editorInputVariants };
