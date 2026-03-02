import * as React from "react";
import { cn } from "@/lib/utils";

// Field Row - Label + Control in a row
interface EditorFieldRowProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  children: React.ReactNode;
}

const EditorFieldRow = React.forwardRef<HTMLDivElement, EditorFieldRowProps>(
  ({ label, children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex items-center gap-2", className)}
        {...props}
      >
        {label && (
          <label className="text-xs text-muted-foreground min-w-[60px]">
            {label}
          </label>
        )}
        <div className="flex-1">{children}</div>
      </div>
    );
  }
);
EditorFieldRow.displayName = "EditorFieldRow";

// Field Group - Group of related fields with spacing
interface EditorFieldGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const EditorFieldGroup = React.forwardRef<HTMLDivElement, EditorFieldGroupProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("space-y-3", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
EditorFieldGroup.displayName = "EditorFieldGroup";

// Field Stack - Label above control
interface EditorFieldStackProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  children: React.ReactNode;
}

const EditorFieldStack = React.forwardRef<HTMLDivElement, EditorFieldStackProps>(
  ({ label, children, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-1.5", className)} {...props}>
        <label className="text-xs font-medium text-foreground">{label}</label>
        {children}
      </div>
    );
  }
);
EditorFieldStack.displayName = "EditorFieldStack";

export { EditorFieldRow, EditorFieldGroup, EditorFieldStack };
