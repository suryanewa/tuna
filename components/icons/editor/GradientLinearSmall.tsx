import * as React from "react";

export interface GradientLinearSmallProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const GradientLinearSmall = React.forwardRef<SVGSVGElement, GradientLinearSmallProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M8 7H11.5V17H8C7.44772 17 7 16.5523 7 16V8C7 7.44772 7.44772 7 8 7Z" fill="currentColor" fillOpacity={0.3}/>
      <path fillRule="evenodd" clipRule="evenodd" d="M12.5 7H16C16.5523 7 17 7.44772 17 8V16C17 16.5523 16.5523 17 16 17H12.5V7ZM11.5 7H8C7.44772 7 7 7.44772 7 8V16C7 16.5523 7.44772 17 8 17H11.5V7ZM6 8C6 6.89543 6.89543 6 8 6H16C17.1046 6 18 6.89543 18 8V16C18 17.1046 17.1046 18 16 18H8C6.89543 18 6 17.1046 6 16V8Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

GradientLinearSmall.displayName = "GradientLinearSmall";
