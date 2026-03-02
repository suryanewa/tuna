import * as React from "react";

export interface LayoutGridRowsProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const LayoutGridRows = React.forwardRef<SVGSVGElement, LayoutGridRowsProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M5 5H19V8H5V5ZM5 11H19V14H5V11ZM19 17H5V20H19V17Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

LayoutGridRows.displayName = "LayoutGridRows";
