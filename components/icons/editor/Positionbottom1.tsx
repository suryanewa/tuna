import * as React from "react";

export interface Positionbottom1Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Positionbottom1 = React.forwardRef<SVGSVGElement, Positionbottom1Props>(
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
      <path d="M12 11C12.5523 11 13 11.4477 13 12C13 12.5523 12.5523 13 12 13L4 13C3.44772 13 3 12.5523 3 12C3 11.4477 3.44771 11 4 11L12 11Z" fill="currentColor"/>
    </svg>
  )
);

Positionbottom1.displayName = "Positionbottom1";
