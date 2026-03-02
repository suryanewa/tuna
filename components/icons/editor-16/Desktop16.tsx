import * as React from "react";

export interface Desktop16Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Desktop16 = React.forwardRef<SVGSVGElement, Desktop16Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M3 10V4H13V10H3ZM2 3.5C2 3.22386 2.22386 3 2.5 3H13.5C13.7761 3 14 3.22386 14 3.5V10.5C14 10.7761 13.7761 11 13.5 11H10V12H10.5C10.7761 12 11 12.2239 11 12.5C11 12.7761 10.7761 13 10.5 13H9.5H6.5H5.5C5.22386 13 5 12.7761 5 12.5C5 12.2239 5.22386 12 5.5 12H6V11H2.5C2.22386 11 2 10.7761 2 10.5V3.5ZM7 11V12H9V11H7Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

Desktop16.displayName = "Desktop16";
