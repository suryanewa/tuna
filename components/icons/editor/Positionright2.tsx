import * as React from "react";

export interface Positionright2Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Positionright2 = React.forwardRef<SVGSVGElement, Positionright2Props>(
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
      <path d="M8 7C7.44772 7 7 7.44772 7 8C7 8.55228 7.44772 9 8 9L12 9C12.5523 9 13 8.55229 13 8C13 7.44772 12.5523 7 12 7L8 7Z" fill="currentColor"/>
    </svg>
  )
);

Positionright2.displayName = "Positionright2";
