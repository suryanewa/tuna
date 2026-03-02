import * as React from "react";

export interface SidebarOpenProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const SidebarOpen = React.forwardRef<SVGSVGElement, SidebarOpenProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M10 7H18C18.5523 7 19 7.44772 19 8V16C19 16.5523 18.5523 17 18 17H10V7ZM9 7H6C5.44772 7 5 7.44772 5 8V16C5 16.5523 5.44772 17 6 17H9V7ZM4 8C4 6.89543 4.89543 6 6 6H18C19.1046 6 20 6.89543 20 8V16C20 17.1046 19.1046 18 18 18H6C4.89543 18 4 17.1046 4 16V8Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

SidebarOpen.displayName = "SidebarOpen";
