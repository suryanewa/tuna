import * as React from "react";

export interface Positionright3Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Positionright3 = React.forwardRef<SVGSVGElement, Positionright3Props>(
  ({ size = 24, className, ...props }, ref) => (
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
      <path d="M11 4C11 3.44772 11.4477 3 12 3C12.5523 3 13 3.44772 13 4V12C13 12.5523 12.5523 13 12 13C11.4477 13 11 12.5523 11 12V4Z" fill="currentColor"/>
    </svg>
  )
);

Positionright3.displayName = "Positionright3";
