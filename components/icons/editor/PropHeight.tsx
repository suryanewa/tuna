import * as React from "react";

export interface PropHeightProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const PropHeight = React.forwardRef<SVGSVGElement, PropHeightProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <g clipPath="url(#clip0_1_535550)">
      <path d="M8.84521 16V8H9.93506V11.5195H14.064V8H15.1499V16H14.064V12.4687H9.93506V16H8.84521Z" fill="currentColor" fillOpacity={0.5}/>
      </g>
      <defs>
      <clipPath id="clip0_1_535550">
      <rect width="24" height="24" fill="white"/>
      </clipPath>
      </defs>
    </svg>
  )
);

PropHeight.displayName = "PropHeight";
