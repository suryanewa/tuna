import * as React from "react";

export interface BorderLargeSmallProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const BorderLargeSmall = React.forwardRef<SVGSVGElement, BorderLargeSmallProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M5 10C5 9.44772 5.44772 9 6 9H18C18.5523 9 19 9.44772 19 10V14C19 14.5523 18.5523 15 18 15H6C5.44772 15 5 14.5523 5 14V10ZM7 10H6V11V13V14H7H17H18V13V11V10H17H7Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

BorderLargeSmall.displayName = "BorderLargeSmall";
