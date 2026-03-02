import * as React from "react";

export interface ChildProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Child = React.forwardRef<SVGSVGElement, ChildProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M11.5 6C11.7761 6 12 6.22386 12 6.5V11C12 11.5523 12.4477 12 13 12H17.5C17.7761 12 18 12.2239 18 12.5C18 12.7761 17.7761 13 17.5 13H13C11.8954 13 11 12.1046 11 11V6.5C11 6.22386 11.2239 6 11.5 6Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

Child.displayName = "Child";
