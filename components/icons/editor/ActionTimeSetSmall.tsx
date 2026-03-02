import * as React from "react";

export interface ActionTimeSetSmallProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const ActionTimeSetSmall = React.forwardRef<SVGSVGElement, ActionTimeSetSmallProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M14 7H15V8V9V15V16V17H14V16V15V9V8V7ZM13 8V7C13 6.44772 13.4477 6 14 6H15C15.5523 6 16 6.44772 16 7V8H18C18.5523 8 19 8.44772 19 9V15C19 15.5523 18.5523 16 18 16H16V17C16 17.5523 15.5523 18 15 18H14C13.4477 18 13 17.5523 13 17V16H6C5.44772 16 5 15.5523 5 15V9C5 8.44772 5.44772 8 6 8H13ZM13 9H6V15H13V9ZM16 15H18V9H16V15Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

ActionTimeSetSmall.displayName = "ActionTimeSetSmall";
