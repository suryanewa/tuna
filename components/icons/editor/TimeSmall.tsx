import * as React from "react";

export interface TimeSmallProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const TimeSmall = React.forwardRef<SVGSVGElement, TimeSmallProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M18 12C18 15.3137 15.3137 18 12 18C8.68629 18 6 15.3137 6 12C6 8.68629 8.68629 6 12 6C15.3137 6 18 8.68629 18 12ZM19 12C19 15.866 15.866 19 12 19C8.134 19 5 15.866 5 12C5 8.134 8.134 5 12 5C15.866 5 19 8.134 19 12ZM12.5 8.5C12.5 8.22386 12.2761 8 12 8C11.7239 8 11.5 8.22386 11.5 8.5V12C11.5 12.1326 11.5527 12.2598 11.6465 12.3535L13.6465 14.3535C13.8417 14.5488 14.1583 14.5488 14.3535 14.3535C14.5488 14.1583 14.5488 13.8417 14.3535 13.6465L12.5 11.7929V8.5Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

TimeSmall.displayName = "TimeSmall";
