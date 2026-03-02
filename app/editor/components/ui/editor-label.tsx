import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const editorLabelVariants = cva("block text-foreground font-medium", {
  variants: {
    size: {
      sm: "text-xs mb-1.5",
      md: "text-sm mb-2",
    },
  },
  defaultVariants: {
    size: "sm",
  },
});

export interface EditorLabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement>,
    VariantProps<typeof editorLabelVariants> {}

const EditorLabel = React.forwardRef<HTMLLabelElement, EditorLabelProps>(
  ({ className, size, ...props }, ref) => {
    return (
      <label
        className={cn(editorLabelVariants({ size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
EditorLabel.displayName = "EditorLabel";

export { EditorLabel, editorLabelVariants };
