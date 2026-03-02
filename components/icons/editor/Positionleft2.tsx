import * as React from "react";

export interface Positionleft2Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Positionleft2 = React.forwardRef<SVGSVGElement, Positionleft2Props>(
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
      <path d="M4 7C3.44772 7 3 7.44772 3 8C3 8.55228 3.44772 9 4 9L8 9C8.55228 9 9 8.55229 9 8C9 7.44772 8.55228 7 8 7L4 7Z" fill="currentColor"/>
    </svg>
  )
);

Positionleft2.displayName = "Positionleft2";
