import * as React from "react";

export interface DropShadowBottomRightSmallProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const DropShadowBottomRightSmall = React.forwardRef<SVGSVGElement, DropShadowBottomRightSmallProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M7 19C7 20.1046 7.89543 21 9 21H19C20.1046 21 21 20.1046 21 19V9C21 7.89543 20.1046 7 19 7V17C19 18.1046 18.1046 19 17 19H7Z" fill="currentColor" fillOpacity={0.3}/>
    </svg>
  )
);

DropShadowBottomRightSmall.displayName = "DropShadowBottomRightSmall";
