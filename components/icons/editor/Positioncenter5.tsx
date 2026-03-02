import * as React from "react";

export interface Positioncenter5Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Positioncenter5 = React.forwardRef<SVGSVGElement, Positioncenter5Props>(
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
      <path d="M7 4C7 3.44772 7.44772 3 8 3C8.55228 3 9 3.44772 9 4V12C9 12.5523 8.55228 13 8 13C7.44772 13 7 12.5523 7 12V4Z" fill="currentColor"/>
    </svg>
  )
);

Positioncenter5.displayName = "Positioncenter5";
