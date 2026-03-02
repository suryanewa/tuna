import * as React from "react";

export interface LayoutGridColumnsProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const LayoutGridColumns = React.forwardRef<SVGSVGElement, LayoutGridColumnsProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M5 5H8V19H5V5ZM11 5H14V19H11V5ZM20 5H17V19H20V5Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

LayoutGridColumns.displayName = "LayoutGridColumns";
