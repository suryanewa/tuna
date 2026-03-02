import * as React from "react";

export interface LayoutDistributeHorizontalSpacingProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const LayoutDistributeHorizontalSpacing = React.forwardRef<SVGSVGElement, LayoutDistributeHorizontalSpacingProps>(
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
      <path d="M12.25 15C12.6642 15 13 14.6642 13 14.25V8.75C13 8.33579 12.6642 8 12.25 8H11.75C11.3358 8 11 8.33579 11 8.75V14.25C11 14.6642 11.3358 15 11.75 15H12.25Z" fill="currentColor" fillOpacity={0.9}/>
      <path fillRule="evenodd" clipRule="evenodd" d="M6.5 5C6.22386 5 6 5.22386 6 5.5V17.5C6 17.7761 6.22386 18 6.5 18C6.77614 18 7 17.7761 7 17.5V5.5C7 5.22386 6.77614 5 6.5 5ZM17.5 5C17.2239 5 17 5.22386 17 5.5V17.5C17 17.7761 17.2239 18 17.5 18C17.7761 18 18 17.7761 18 17.5V5.5C18 5.22386 17.7761 5 17.5 5Z" fill="currentColor" fillOpacity={0.3}/>
    </svg>
  )
);

LayoutDistributeHorizontalSpacing.displayName = "LayoutDistributeHorizontalSpacing";
