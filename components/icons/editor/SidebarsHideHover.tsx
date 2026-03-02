import * as React from "react";

export interface SidebarsHideHoverProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const SidebarsHideHover = React.forwardRef<SVGSVGElement, SidebarsHideHoverProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M19 6H5C4.44772 6 4 6.44772 4 7V17C4 17.5523 4.44772 18 5 18H19C19.5523 18 20 17.5523 20 17V7C20 6.44772 19.5523 6 19 6ZM5 5C3.89543 5 3 5.89543 3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V7C21 5.89543 20.1046 5 19 5H5Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

SidebarsHideHover.displayName = "SidebarsHideHover";
