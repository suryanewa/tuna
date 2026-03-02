import * as React from "react";

export interface Positionbottom2Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Positionbottom2 = React.forwardRef<SVGSVGElement, Positionbottom2Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M8 7C7.44772 7 7 7.44772 7 8V12C7 12.5523 7.44772 13 8 13C8.55228 13 9 12.5523 9 12V8C9 7.44772 8.55228 7 8 7Z" fill="currentColor"/>
    </svg>
  )
);

Positionbottom2.displayName = "Positionbottom2";
