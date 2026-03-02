import * as React from "react";

export interface Tablet16Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Tablet16 = React.forwardRef<SVGSVGElement, Tablet16Props>(
  ({ size = 16, className, ...props }, ref) => (
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
      <path fillRule="evenodd" clipRule="evenodd" d="M4.5 3H11.5C11.7761 3 12 3.22386 12 3.5V12.5C12 12.7761 11.7761 13 11.5 13H4.5C4.22386 13 4 12.7761 4 12.5V3.5C4 3.22386 4.22386 3 4.5 3ZM3 3.5C3 2.67157 3.67157 2 4.5 2H11.5C12.3284 2 13 2.67157 13 3.5V12.5C13 13.3284 12.3284 14 11.5 14H4.5C3.67157 14 3 13.3284 3 12.5V3.5ZM8 12C8.27614 12 8.5 11.7761 8.5 11.5C8.5 11.2239 8.27614 11 8 11C7.72386 11 7.5 11.2239 7.5 11.5C7.5 11.7761 7.72386 12 8 12Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

Tablet16.displayName = "Tablet16";
