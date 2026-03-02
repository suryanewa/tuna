import * as React from "react";

export interface FlexFrameProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const FlexFrame = React.forwardRef<SVGSVGElement, FlexFrameProps>(
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
      <path d="M4.5 14C4.77614 14 5 14.2239 5 14.5V18C5 18.5523 5.44772 19 6 19H9.5C9.77614 19 10 19.2239 10 19.5C10 19.7761 9.77614 20 9.5 20H6C4.89543 20 4 19.1046 4 18V14.5C4 14.2239 4.22386 14 4.5 14ZM20 18C20 19.1046 19.1046 20 18 20H14.5C14.2239 20 14 19.7761 14 19.5C14 19.2239 14.2239 19 14.5 19H18C18.5523 19 19 18.5523 19 18V14.5C19 14.2239 19.2239 14 19.5 14C19.7761 14 20 14.2239 20 14.5V18ZM18 4C19.1046 4 20 4.89543 20 6V9.5C20 9.77614 19.7761 10 19.5 10C19.2239 10 19 9.77614 19 9.5V6C19 5.44772 18.5523 5 18 5H14.5C14.2239 5 14 4.77614 14 4.5C14 4.22386 14.2239 4 14.5 4H18ZM10 4.5C10 4.77614 9.77614 5 9.5 5H6C5.44772 5 5 5.44772 5 6V9.5C5 9.77614 4.77614 10 4.5 10C4.22386 10 4 9.77614 4 9.5V6C4 4.89543 4.89543 4 6 4H9.5C9.77614 4 10 4.22386 10 4.5Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

FlexFrame.displayName = "FlexFrame";
