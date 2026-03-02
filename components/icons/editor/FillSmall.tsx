import * as React from "react";

export interface FillSmallProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const FillSmall = React.forwardRef<SVGSVGElement, FillSmallProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M8 7H16C16.5523 7 17 7.44771 17 8V16C17 16.5523 16.5523 17 16 17H8C7.44771 17 7 16.5523 7 16V8C7 7.44771 7.44771 7 8 7ZM6 8C6 6.89543 6.89543 6 8 6H16C17.1046 6 18 6.89543 18 8V16C18 17.1046 17.1046 18 16 18H8C6.89543 18 6 17.1046 6 16V8ZM9 15V9H15V15H9ZM8 8.75C8 8.33578 8.33578 8 8.75 8H15.25C15.6642 8 16 8.33578 16 8.75V15.25C16 15.6642 15.6642 16 15.25 16H8.75C8.33578 16 8 15.6642 8 15.25V8.75Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

FillSmall.displayName = "FillSmall";
