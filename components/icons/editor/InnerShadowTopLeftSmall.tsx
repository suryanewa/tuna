import * as React from "react";

export interface InnerShadowTopLeftSmallProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const InnerShadowTopLeftSmall = React.forwardRef<SVGSVGElement, InnerShadowTopLeftSmallProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M17 6H7C6.44772 6 6 6.44772 6 7V17C6 17.5523 6.44772 18 7 18H17C17.5523 18 18 17.5523 18 17V7C18 6.44772 17.5523 6 17 6ZM7 5C5.89543 5 5 5.89543 5 7V17C5 18.1046 5.89543 19 7 19H17C18.1046 19 19 18.1046 19 17V7C19 5.89543 18.1046 5 17 5H7Z" fill="currentColor" fillOpacity={0.9}/>
      <path fillRule="evenodd" clipRule="evenodd" d="M7 6C6.44772 6 6 6.44772 6 7V17C6 17.5523 6.44772 18 7 18H8V9C8 8.44772 8.44772 8 9 8H18V7C18 6.44772 17.5523 6 17 6H7Z" fill="currentColor" fillOpacity={0.3}/>
    </svg>
  )
);

InnerShadowTopLeftSmall.displayName = "InnerShadowTopLeftSmall";
