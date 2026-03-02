import * as React from "react";

export interface Positioncenter6Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Positioncenter6 = React.forwardRef<SVGSVGElement, Positioncenter6Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M8 5C7.44772 5 7 5.44772 7 6V10C7 10.5523 7.44772 11 8 11C8.55228 11 9 10.5523 9 10V6C9 5.44772 8.55228 5 8 5Z" fill="currentColor"/>
    </svg>
  )
);

Positioncenter6.displayName = "Positioncenter6";
