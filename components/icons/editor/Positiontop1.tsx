import * as React from "react";

export interface Positiontop1Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Positiontop1 = React.forwardRef<SVGSVGElement, Positiontop1Props>(
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
      <path d="M12 3C12.5523 3 13 3.44772 13 4C13 4.55229 12.5523 5 12 5L4 5C3.44772 5 3 4.55228 3 4C3 3.44772 3.44771 3 4 3L12 3Z" fill="currentColor"/>
    </svg>
  )
);

Positiontop1.displayName = "Positiontop1";
