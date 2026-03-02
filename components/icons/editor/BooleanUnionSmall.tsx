import * as React from "react";

export interface BooleanUnionSmallProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const BooleanUnionSmall = React.forwardRef<SVGSVGElement, BooleanUnionSmallProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M14 7H7V14H10V17H17V10H14V7Z" fill="currentColor" fillOpacity={0.3}/>
      <path fillRule="evenodd" clipRule="evenodd" d="M10 14V15V17H17V10H15H14V9V7L7 7V14H9H10ZM8 15H7C6.44772 15 6 14.5523 6 14V7C6 6.44772 6.44772 6 7 6H14C14.5523 6 15 6.44772 15 7V8V9H16H17C17.5523 9 18 9.44772 18 10V17C18 17.5523 17.5523 18 17 18H10C9.44772 18 9 17.5523 9 17V16V15H8Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

BooleanUnionSmall.displayName = "BooleanUnionSmall";
