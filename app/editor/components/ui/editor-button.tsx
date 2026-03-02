import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const editorButtonVariants = cva(
  "inline-flex items-center justify-center transition-colors focus:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        ghost: "hover:bg-muted text-muted-foreground hover:text-foreground",
        outline: "border border-border bg-background hover:bg-muted",
        destructive: "hover:bg-destructive/10 text-destructive",
        trigger: "w-full flex items-center gap-2 px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground hover:bg-muted/50 text-left",
      },
      size: {
        sm: "h-8 w-8 rounded",
        md: "h-9 w-9 rounded-md",
        lg: "h-10 w-10 rounded-md",
        auto: "p-1.5 rounded-md",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "auto",
    },
  }
);

export interface EditorButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof editorButtonVariants> {}

const EditorButton = React.forwardRef<HTMLButtonElement, EditorButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(editorButtonVariants({ variant, size, className }))}
        ref={ref}
        type="button"
        {...props}
      />
    );
  }
);
EditorButton.displayName = "EditorButton";

export { EditorButton, editorButtonVariants };
