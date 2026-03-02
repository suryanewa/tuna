import * as React from "react";

export interface BorderMediumSmallProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const BorderMediumSmall = React.forwardRef<SVGSVGElement, BorderMediumSmallProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M5 11C5 10.4477 5.44772 10 6 10H18C18.5523 10 19 10.4477 19 11V13C19 13.5523 18.5523 14 18 14H6C5.44772 14 5 13.5523 5 13V11ZM7 11H6V12V13H7H17H18V12V11H17H7Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

BorderMediumSmall.displayName = "BorderMediumSmall";
