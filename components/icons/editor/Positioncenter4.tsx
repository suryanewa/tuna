import * as React from "react";

export interface Positioncenter4Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Positioncenter4 = React.forwardRef<SVGSVGElement, Positioncenter4Props>(
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
      <path d="M6 7C5.44772 7 5 7.44772 5 8C5 8.55228 5.44772 9 6 9L10 9C10.5523 9 11 8.55228 11 8C11 7.44772 10.5523 7 10 7L6 7Z" fill="currentColor"/>
    </svg>
  )
);

Positioncenter4.displayName = "Positioncenter4";
