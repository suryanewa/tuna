import * as React from "react";

export interface Positiontop2Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Positiontop2 = React.forwardRef<SVGSVGElement, Positiontop2Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M8 3C7.44772 3 7 3.44772 7 4V8C7 8.55228 7.44772 9 8 9C8.55228 9 9 8.55228 9 8V4C9 3.44772 8.55228 3 8 3Z" fill="currentColor"/>
    </svg>
  )
);

Positiontop2.displayName = "Positiontop2";
