import * as React from "react";

export interface Unread16Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Unread16 = React.forwardRef<SVGSVGElement, Unread16Props>(
  ({ size = 16, className, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M5 8C5 6.34315 6.34315 5 8 5C9.65685 5 11 6.34315 11 8C11 9.65685 9.65685 11 8 11C6.34315 11 5 9.65685 5 8Z" fill="currentColor"/>
    </svg>
  )
);

Unread16.displayName = "Unread16";
