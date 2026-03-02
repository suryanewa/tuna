import * as React from "react";

export interface LayoutDistributeVerticalSpacingProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const LayoutDistributeVerticalSpacing = React.forwardRef<SVGSVGElement, LayoutDistributeVerticalSpacingProps>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M19 6.5C19 6.22386 18.7761 6 18.5 6H6.5C6.22386 6 6 6.22386 6 6.5C6 6.77614 6.22386 7 6.5 7H18.5C18.7761 7 19 6.77614 19 6.5ZM19 17.5C19 17.2239 18.7761 17 18.5 17H6.5C6.22386 17 6 17.2239 6 17.5C6 17.7761 6.22386 18 6.5 18H18.5C18.7761 18 19 17.7761 19 17.5Z" fill="currentColor" fillOpacity={0.3}/>
      <path d="M9 12.25C9 12.6642 9.33579 13 9.75 13H15.25C15.6642 13 16 12.6642 16 12.25V11.75C16 11.3358 15.6642 11 15.25 11H9.75C9.33579 11 9 11.3358 9 11.75V12.25Z" fill="currentColor" fillOpacity={0.9}/>
    </svg>
  )
);

LayoutDistributeVerticalSpacing.displayName = "LayoutDistributeVerticalSpacing";
