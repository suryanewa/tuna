import * as React from "react";

export interface Positionleft3Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Positionleft3 = React.forwardRef<SVGSVGElement, Positionleft3Props>(
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
      <path d="M3 4C3 3.44772 3.44772 3 4 3C4.55228 3 5 3.44772 5 4V12C5 12.5523 4.55228 13 4 13C3.44772 13 3 12.5523 3 12V4Z" fill="currentColor"/>
    </svg>
  )
);

Positionleft3.displayName = "Positionleft3";
