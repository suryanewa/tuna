import * as React from "react";

export interface Positioncenter3Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Positioncenter3 = React.forwardRef<SVGSVGElement, Positioncenter3Props>(
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
      <path d="M12 7C12.5523 7 13 7.44772 13 8C13 8.55229 12.5523 9 12 9L4 9C3.44772 9 3 8.55228 3 8C3 7.44772 3.44771 7 4 7L12 7Z" fill="currentColor"/>
    </svg>
  )
);

Positioncenter3.displayName = "Positioncenter3";
