import * as React from "react";

export interface AlPaddingRightProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const AlPaddingRight = React.forwardRef<SVGSVGElement, AlPaddingRightProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M17 7.5C17 7.22386 16.7761 7 16.5 7C16.2239 7 16 7.22386 16 7.5V16.5C16 16.7761 16.2239 17 16.5 17C16.7761 17 17 16.7761 17 16.5V7.5ZM13 11V13H11V11H13ZM13 10C13.5523 10 14 10.4477 14 11V13C14 13.5523 13.5523 14 13 14H11C10.4477 14 10 13.5523 10 13V11C10 10.4477 10.4477 10 11 10H13Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

AlPaddingRight.displayName = "AlPaddingRight";
